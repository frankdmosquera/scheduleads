// The who-does-what ticks' rules, proved by inserting rows directly into the local database.
// Every business here is a throwaway carrying this run's tag, removed after (its services,
// people, places and ticks go with it).

import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the who-does-what tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { bookingLink, bookingLinkResource, organization, resource } =
  await import("@scheduleads-app/shared/db");

const tag = randomUUID().slice(0, 8);

// A business of its own with a service, a practitioner and a room, so no test depends on
// another having run.
async function makeBusiness(name: string) {
  const business = randomUUID();
  await db.insert(organization).values({ id: business, name, slug: `test-ticks-${name}-${tag}` });
  const [facial, ana, room] = [randomUUID(), randomUUID(), randomUUID()];
  await db.insert(bookingLink).values({
    id: facial,
    organizationId: business,
    name: "Deep Cleansing Facial",
    slug: "deep-cleansing-facial",
    durationMinutes: 75,
  });
  await db.insert(resource).values([
    { id: ana, organizationId: business, name: "Ana", kind: "person" },
    { id: room, organizationId: business, name: "Room 3", kind: "place" },
  ]);
  return { business, facial, ana, room };
}

const tick = (organizationId: string, bookingLinkId: string, resourceId: string) => ({
  organizationId,
  bookingLinkId,
  resourceId,
});

const refusedBy = (code: string, constraint: string) => ({
  cause: { code, constraint_name: constraint },
});

const ticksOf = (bookingLinkId: string) =>
  db.select().from(bookingLinkResource).where(eq(bookingLinkResource.bookingLinkId, bookingLinkId));

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-ticks-%-${tag}`));
  await db.$client.end();
});

describe("who-does-what rules in the database", () => {
  test("a person and a place can be ticked for a service", async () => {
    const { business, facial, ana, room } = await makeBusiness("ticked");
    await db
      .insert(bookingLinkResource)
      .values([tick(business, facial, ana), tick(business, facial, room)]);
    expect((await ticksOf(facial)).map((row) => row.resourceId).sort()).toEqual([ana, room].sort());
  });

  test("the same tick twice is refused", async () => {
    const { business, facial, ana } = await makeBusiness("twice");
    await db.insert(bookingLinkResource).values(tick(business, facial, ana));
    await expect(
      db.insert(bookingLinkResource).values(tick(business, facial, ana))
    ).rejects.toMatchObject(
      refusedBy("23505", "booking_link_resource_bookingLinkId_resourceId_pk")
    );
  });

  test("a tick cannot name another business's service", async () => {
    const mine = await makeBusiness("mine-service");
    const theirs = await makeBusiness("theirs-service");
    await expect(
      db.insert(bookingLinkResource).values(tick(mine.business, theirs.facial, mine.ana))
    ).rejects.toMatchObject(refusedBy("23503", "booking_link_resource_booking_link_fk"));
    expect(await ticksOf(theirs.facial)).toHaveLength(0);
  });

  test("a tick cannot name another business's person or place", async () => {
    const mine = await makeBusiness("mine-people");
    const theirs = await makeBusiness("theirs-people");
    for (const theirResource of [theirs.ana, theirs.room]) {
      await expect(
        db.insert(bookingLinkResource).values(tick(mine.business, mine.facial, theirResource))
      ).rejects.toMatchObject(refusedBy("23503", "booking_link_resource_resource_fk"));
    }
    expect(await ticksOf(mine.facial)).toHaveLength(0);
  });

  test("deleting a service takes its ticks", async () => {
    const { business, facial, ana, room } = await makeBusiness("service-gone");
    await db
      .insert(bookingLinkResource)
      .values([tick(business, facial, ana), tick(business, facial, room)]);
    await db.delete(bookingLink).where(eq(bookingLink.id, facial));
    expect(await ticksOf(facial)).toHaveLength(0);
  });

  test("deleting a person takes their ticks, and leaves the rest", async () => {
    const { business, facial, ana, room } = await makeBusiness("person-gone");
    await db
      .insert(bookingLinkResource)
      .values([tick(business, facial, ana), tick(business, facial, room)]);
    await db.delete(resource).where(eq(resource.id, ana));
    expect((await ticksOf(facial)).map((row) => row.resourceId)).toEqual([room]);
  });

  test("deleting the whole business takes its ticks", async () => {
    const { business, facial, ana, room } = await makeBusiness("gone");
    await db
      .insert(bookingLinkResource)
      .values([tick(business, facial, ana), tick(business, facial, room)]);
    await db.delete(organization).where(eq(organization.id, business));
    expect(await ticksOf(facial)).toHaveLength(0);
  });
});
