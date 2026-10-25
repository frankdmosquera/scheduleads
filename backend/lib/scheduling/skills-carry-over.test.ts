// Migration 0033's carry-over (feature 12k), against the local database: a business shaped the old
// way ("ticked people, or anyone when nobody is ticked") offers exactly the same people after it.
// The carry-over runs in a transaction that is always rolled back, so no other business changes.

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the skills carry-over test");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { bookingLink, bookingLinkResource, organization, resource } =
  await import("@scheduleads-app/shared/db");

const migration = readFileSync(
  new URL("../../../packages/shared/migrations/0033_person_skill.sql", import.meta.url),
  "utf8"
);
const carryOver = migration
  .slice(migration.indexOf("-- The carry-over"))
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter(Boolean);

const business = randomUUID();
const id = () => randomUUID();
const people = { ana: id(), mei: id(), gone: id() };
const room = id();
const services = { facial: id(), peel: id(), laser: id(), estimate: id() };

afterAll(async () => {
  await db.delete(organization).where(eq(organization.id, business));
  await db.$client.end();
});

// Who the old rule offered: the active ticked people, or every active person when none is ticked.
const oldRule: Record<keyof typeof services, string[]> = {
  facial: [people.ana, people.mei].sort(), // Ana, Mei and Gone ticked; Gone has left
  peel: [people.ana, people.mei].sort(), // only a room ticked: anyone
  laser: [], // only Gone ticked: nobody, never anyone
  estimate: [people.ana, people.mei].sort(), // nothing ticked: anyone
};

describe("the skills carry-over", () => {
  test("offers exactly who the old rule offered, and every one on can do it", async () => {
    await db
      .insert(organization)
      .values({ id: business, name: "Carry", slug: `test-carry-${business}` });
    await db.insert(resource).values([
      { id: people.ana, organizationId: business, name: "Ana", kind: "person" },
      { id: people.mei, organizationId: business, name: "Mei", kind: "person" },
      { id: people.gone, organizationId: business, name: "Gone", kind: "person", active: false },
      { id: room, organizationId: business, name: "Room 1", kind: "place" },
    ]);
    await db.insert(bookingLink).values(
      Object.entries(services).map(([slug, serviceId]) => ({
        id: serviceId,
        organizationId: business,
        name: slug,
        slug,
        durationMinutes: 60,
        layout: "month",
        addressMode: "required",
        personChoice: "customer_picks",
      }))
    );
    const ticks: [string, string][] = [
      [services.facial, people.ana],
      [services.facial, people.mei],
      [services.facial, people.gone],
      [services.facial, room],
      [services.peel, room],
      [services.laser, people.gone],
    ];
    await db.insert(bookingLinkResource).values(
      ticks.map(([bookingLinkId, resourceId]) => ({
        organizationId: business,
        bookingLinkId,
        resourceId,
      }))
    );

    const rollback = new Error("rolled back on purpose");
    const after = await db
      .transaction(async (tx) => {
        for (const statement of carryOver) await tx.execute(sql.raw(statement));
        const offered = {} as Record<keyof typeof services, string[]>;
        for (const [name, serviceId] of Object.entries(services) as [
          keyof typeof services,
          string,
        ][]) {
          // The rule's own reading: on, able, active.
          const rows = await tx.execute<{ id: string }>(sql`
            SELECT "resource"."id" FROM "booking_link_resource"
            JOIN "resource" ON "resource"."id" = "booking_link_resource"."resourceId"
            JOIN "person_skill" ON "person_skill"."resourceId" = "booking_link_resource"."resourceId"
              AND "person_skill"."bookingLinkId" = "booking_link_resource"."bookingLinkId"
            WHERE "booking_link_resource"."bookingLinkId" = ${serviceId}
              AND "resource"."kind" = 'person' AND "resource"."active"`);
          offered[name] = rows.map((row) => row.id).sort();
        }
        const onWithoutSkill = await tx.execute<{ count: number }>(sql`
          SELECT count(*)::int AS "count" FROM "booking_link_resource"
          JOIN "resource" ON "resource"."id" = "booking_link_resource"."resourceId"
          LEFT JOIN "person_skill" ON "person_skill"."resourceId" = "booking_link_resource"."resourceId"
            AND "person_skill"."bookingLinkId" = "booking_link_resource"."bookingLinkId"
          WHERE "booking_link_resource"."organizationId" = ${business}
            AND "resource"."kind" = 'person' AND "person_skill"."resourceId" IS NULL`);
        throw Object.assign(rollback, { offered, onWithoutSkill: onWithoutSkill[0].count });
      })
      .catch((error: unknown) => {
        if (error !== rollback) throw error;
        return error as Error & { offered: typeof oldRule; onWithoutSkill: number };
      });

    expect(after.offered).toEqual(oldRule);
    expect(after.onWithoutSkill).toBe(0);
  });
});
