// Runs against the local scheduleads_dev on throwaway businesses, removed after; refuses any
// other database through the same guard as the seed.

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import * as schema from "../db/index.js";
import {
  availabilityRule,
  bookingLink,
  bookingLinkResource,
  bookingQuestion,
  organization,
  resource,
} from "../db/index.js";
import { assertLocalDevDatabase } from "../helpers/assert-local-dev-database.js";
import {
  clientSetupValidationSchema,
  type ClientSetupInputType,
} from "../zod-validation/admin-validation-schemas/client-setup-validation-schema.js";
import { runClientSetup } from "./run-client-setup.js";

if (!process.env.DATABASE_URL) process.loadEnvFile("../../.env");
assertLocalDevDatabase(process.env.DATABASE_URL, "client setup tests");
const client = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const db = drizzle(client, { schema });

const madeBusinessIds: string[] = [];
afterAll(async () => {
  for (const id of madeBusinessIds) await db.delete(organization).where(eq(organization.id, id));
  await client.end();
});

// A business as the client setup screen leaves it: the business and its first person.
async function makeBusiness(): Promise<{ id: string; slug: string }> {
  const id = randomUUID();
  const slug = `setup-test-${id.slice(0, 8)}-dev`;
  await db.insert(organization).values({ id, name: `Setup Test ${slug}`, slug });
  await db
    .insert(resource)
    .values({ id: randomUUID(), organizationId: id, name: `Setup Test ${slug}`, kind: "person" });
  madeBusinessIds.push(id);
  return { id, slug };
}

const fileFor = (slug: string): ClientSetupInputType => ({
  slug,
  personChoice: "business_assigns",
  questions: [{ label: "What is your business?", required: true }],
  hours: {
    weeklyHours: { mon: [{ startMinute: 480, endMinute: 1080 }] },
    timezone: "America/Bogota",
    minimumNoticeMinutes: 0,
    horizonDays: 21,
    closedDates: [],
  },
  people: [{ name: "Room A", kind: "place" }],
  services: [
    { name: "Video call", durationMinutes: 30, slotIntervalMinutes: 30, ticked: ["Room A"] },
    { name: "Phone call", durationMinutes: 30 },
  ],
});
const setupFor = (slug: string) => clientSetupValidationSchema.parse(fileFor(slug));

async function countRows(organizationId: string) {
  const inBusiness = <T extends { organizationId: typeof organization.id }>(table: T) =>
    eq(table.organizationId, organizationId);
  return {
    questions: (await db.select().from(bookingQuestion).where(inBusiness(bookingQuestion))).length,
    hours: (await db.select().from(availabilityRule).where(inBusiness(availabilityRule))).length,
    resources: (await db.select().from(resource).where(inBusiness(resource))).length,
    services: (await db.select().from(bookingLink).where(inBusiness(bookingLink))).length,
    ticks: (await db.select().from(bookingLinkResource).where(inBusiness(bookingLinkResource)))
      .length,
  };
}

describe("a setup file", () => {
  it("is refused when it is not a valid setup", () => {
    const file = fileFor("any-dev");
    expect(clientSetupValidationSchema.safeParse({ ...file, services: [] }).success).toBe(false);
    expect(clientSetupValidationSchema.safeParse({ ...file, plan: "agency" }).success).toBe(false);
    expect(
      clientSetupValidationSchema.safeParse({
        ...file,
        people: [
          {
            name: "Room A",
            kind: "place",
            workerTexts: { phone: "403 555 0161", addedOn: true, movedOn: true, removedOn: true },
          },
        ],
      }).success
    ).toBe(false);
    expect(
      clientSetupValidationSchema.safeParse({
        ...file,
        hours: { ...file.hours, timezone: "Mars/Olympus" },
      }).success
    ).toBe(false);
  });
});

describe("runClientSetup", () => {
  it("refuses a business that does not exist, and makes none", async () => {
    const slug = `setup-test-missing-${randomUUID().slice(0, 8)}-dev`;
    const result = await runClientSetup(db, setupFor(slug), { apply: true });
    expect(result.ok).toBe(false);
    const [made] = await db.select().from(organization).where(eq(organization.slug, slug));
    expect(made).toBeUndefined();
  });

  it("writes nothing on a dry run, yet reports what it would add", async () => {
    const business = await makeBusiness();
    const result = await runClientSetup(db, setupFor(business.slug), { apply: false });
    expect(result).toMatchObject({ ok: true, applied: false });
    expect(result.ok && result.made).toContain("2 services");
    expect(await countRows(business.id)).toEqual({
      questions: 0,
      hours: 0,
      resources: 1,
      services: 0,
      ticks: 0,
    });
  });

  it("makes every row on apply, then a second apply changes nothing", async () => {
    const business = await makeBusiness();
    const first = await runClientSetup(db, setupFor(business.slug), { apply: true });
    expect(first).toMatchObject({ ok: true, applied: true, differences: [] });
    expect(await countRows(business.id)).toEqual({
      questions: 1,
      hours: 1,
      resources: 2,
      services: 2,
      ticks: 1,
    });

    const second = await runClientSetup(db, setupFor(business.slug), { apply: true });
    expect(second).toMatchObject({ ok: true, made: [], differences: [] });
    expect(await countRows(business.id)).toEqual({
      questions: 1,
      hours: 1,
      resources: 2,
      services: 2,
      ticks: 1,
    });
  });

  it("keeps a row changed by hand and reports the difference", async () => {
    const business = await makeBusiness();
    await runClientSetup(db, setupFor(business.slug), { apply: true });
    const byHand = and(
      eq(bookingLink.organizationId, business.id),
      eq(bookingLink.slug, "video-call")
    );
    await db.update(bookingLink).set({ durationMinutes: 45 }).where(byHand);
    await db
      .update(availabilityRule)
      .set({ horizonDays: 30 })
      .where(eq(availabilityRule.organizationId, business.id));

    const result = await runClientSetup(db, setupFor(business.slug), { apply: true });
    expect(result.ok && result.made).toEqual([]);
    expect(result.ok && result.differences).toEqual([
      "hours, horizonDays: saved 30, file 21",
      '"Video call", durationMinutes: saved 45, file 30',
    ]);
    const [kept] = await db.select().from(bookingLink).where(byHand);
    expect(kept?.durationMinutes).toBe(45);
  });
});
