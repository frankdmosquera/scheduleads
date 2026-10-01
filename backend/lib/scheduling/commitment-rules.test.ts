// The commitment table's rules, proved by inserting rows directly into the local database.
// Every business here is a throwaway carrying this run's tag, removed after (its people,
// places and commitments go with it).

import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the commitment tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { commitment, organization, resource } = await import("@scheduleads-app/shared/db");

const tag = randomUUID().slice(0, 8);

// A business of its own with two people and a place, so no test depends on another having run.
async function makeBusiness(name: string) {
  const business = randomUUID();
  await db
    .insert(organization)
    .values({ id: business, name, slug: `test-commitment-${name}-${tag}` });
  const [ana, luis, room] = [randomUUID(), randomUUID(), randomUUID()];
  await db.insert(resource).values([
    { id: ana, organizationId: business, name: "Ana", kind: "person" },
    { id: luis, organizationId: business, name: "Luis", kind: "person" },
    { id: room, organizationId: business, name: "Room 1", kind: "place" },
  ]);
  return { business, ana, luis, room };
}

const at = (time: string) => new Date(`2026-10-05T${time}:00Z`);

const row = (
  organizationId: string,
  resourceId: string,
  from: string,
  to: string,
  changes: Record<string, unknown> = {}
) => ({
  id: randomUUID(),
  organizationId,
  resourceId,
  kind: "booking",
  startsAt: at(from),
  endsAt: at(to),
  ...changes,
});

const refusedBy = (code: string, constraint: string) => ({
  cause: { code, constraint_name: constraint },
});

const commitmentsOf = (resourceId: string) =>
  db.select().from(commitment).where(eq(commitment.resourceId, resourceId));

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-commitment-%-${tag}`));
  await db.$client.end();
});

describe("commitment rules in the database", () => {
  test("two overlapping active rows for one person are refused", async () => {
    const { business, ana } = await makeBusiness("overlap");
    await db.insert(commitment).values(row(business, ana, "15:00", "16:00"));
    await expect(
      db.insert(commitment).values(row(business, ana, "15:30", "16:30"))
    ).rejects.toMatchObject(refusedBy("23P01", "commitment_no_overlap"));
    expect(await commitmentsOf(ana)).toHaveLength(1);
  });

  test("time off overlapping a booking is refused too", async () => {
    const { business, ana } = await makeBusiness("time-off");
    await db.insert(commitment).values(row(business, ana, "15:00", "16:00"));
    await expect(
      db.insert(commitment).values(row(business, ana, "09:00", "17:00", { kind: "time_off" }))
    ).rejects.toMatchObject(refusedBy("23P01", "commitment_no_overlap"));
  });

  test("two people, or a person and a place, can be taken at the same time", async () => {
    const { business, ana, luis, room } = await makeBusiness("together");
    await db
      .insert(commitment)
      .values([
        row(business, ana, "15:00", "16:00"),
        row(business, luis, "15:00", "16:00"),
        row(business, room, "15:00", "16:00"),
      ]);
    expect(await commitmentsOf(ana)).toHaveLength(1);
    expect(await commitmentsOf(luis)).toHaveLength(1);
    expect(await commitmentsOf(room)).toHaveLength(1);
  });

  test("back to back is allowed: one ends at 3pm, the next starts at 3pm", async () => {
    const { business, ana } = await makeBusiness("back-to-back");
    await db.insert(commitment).values(row(business, ana, "14:00", "15:00"));
    await db.insert(commitment).values(row(business, ana, "15:00", "16:00"));
    expect(await commitmentsOf(ana)).toHaveLength(2);
  });

  test("a cancelled row no longer blocks", async () => {
    const { business, ana } = await makeBusiness("cancelled");
    const first = row(business, ana, "15:00", "16:00");
    await db.insert(commitment).values(first);
    await db.update(commitment).set({ status: "cancelled" }).where(eq(commitment.id, first.id));
    await db.insert(commitment).values(row(business, ana, "15:00", "16:00"));
    // and a row saved as cancelled never blocks an active one
    await db
      .insert(commitment)
      .values(row(business, ana, "15:30", "16:30", { status: "cancelled" }));
    expect(await commitmentsOf(ana)).toHaveLength(3);
  });

  test("a cancelled row cannot come back over time someone else took", async () => {
    const { business, ana } = await makeBusiness("revived");
    const first = row(business, ana, "15:00", "16:00", { status: "cancelled" });
    await db.insert(commitment).values(first);
    await db.insert(commitment).values(row(business, ana, "15:00", "16:00"));
    await expect(
      db.update(commitment).set({ status: "active" }).where(eq(commitment.id, first.id))
    ).rejects.toMatchObject(refusedBy("23P01", "commitment_no_overlap"));
  });

  test("a row whose end is not after its start is refused", async () => {
    const { business, ana } = await makeBusiness("order");
    await expect(
      db.insert(commitment).values(row(business, ana, "15:00", "15:00"))
    ).rejects.toMatchObject(refusedBy("23514", "commitment_time_order_check"));
    await expect(
      db.insert(commitment).values(row(business, ana, "16:00", "15:00"))
    ).rejects.toMatchObject(refusedBy("23514", "commitment_time_order_check"));
  });

  test("a kind or status outside the list is refused", async () => {
    const { business, ana } = await makeBusiness("lists");
    await expect(
      db.insert(commitment).values(row(business, ana, "15:00", "16:00", { kind: "lunch" }))
    ).rejects.toMatchObject(refusedBy("23514", "commitment_kind_check"));
    await expect(
      db.insert(commitment).values(row(business, ana, "15:00", "16:00", { status: "maybe" }))
    ).rejects.toMatchObject(refusedBy("23514", "commitment_status_check"));
  });

  test("a row cannot name another business's person", async () => {
    const mine = await makeBusiness("mine");
    const theirs = await makeBusiness("theirs");
    await expect(
      db.insert(commitment).values(row(mine.business, theirs.ana, "15:00", "16:00"))
    ).rejects.toMatchObject(refusedBy("23503", "commitment_resource_fk"));
    expect(await commitmentsOf(theirs.ana)).toHaveLength(0);
  });

  test("another business's person who is busy is refused the same way, never as taken", async () => {
    const mine = await makeBusiness("mine-busy");
    const theirs = await makeBusiness("theirs-busy");
    await db.insert(commitment).values(row(theirs.business, theirs.ana, "15:00", "16:00"));
    await expect(
      db.insert(commitment).values(row(mine.business, theirs.ana, "15:00", "16:00"))
    ).rejects.toMatchObject(refusedBy("23503", "commitment_resource_fk"));
  });

  test("deleting a person who has ever held time is refused, cancelled time included", async () => {
    const { business, ana, luis } = await makeBusiness("keep-person");
    await db.insert(commitment).values(row(business, ana, "15:00", "16:00"));
    await db
      .insert(commitment)
      .values(row(business, luis, "15:00", "16:00", { status: "cancelled" }));
    for (const person of [ana, luis]) {
      await expect(db.delete(resource).where(eq(resource.id, person))).rejects.toMatchObject(
        refusedBy("23503", "commitment_resource_fk")
      );
      expect(await db.select().from(resource).where(eq(resource.id, person))).toHaveLength(1);
    }
  });

  test("deleting the whole business takes its commitments", async () => {
    const { business, ana, room } = await makeBusiness("gone");
    await db
      .insert(commitment)
      .values([row(business, ana, "15:00", "16:00"), row(business, room, "15:00", "16:00")]);
    await db.delete(organization).where(eq(organization.id, business));
    expect(await commitmentsOf(ana)).toHaveLength(0);
    expect(await commitmentsOf(room)).toHaveLength(0);
  });
});
