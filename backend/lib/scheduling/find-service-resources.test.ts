// Who may be offered for a service, against the local database. Every business here is a
// throwaway carrying this run's tag, removed after (its services, people, places and ticks go
// with it).

import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterAll, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the who-does-what reading tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { bookingLink, bookingLinkResource, organization, resource } =
  await import("@scheduleads-app/shared/db");
const { findServiceResources } = await import("./find-service-resources.js");

const tag = randomUUID().slice(0, 8);

// A clinic of its own, shaped like Face and Body: people (one already inactive), rooms (one
// inactive), and services ticked the clinic's way. No test depends on another having run.
async function makeClinic(name: string) {
  const business = randomUUID();
  await db.insert(organization).values({ id: business, name, slug: `test-offer-${name}-${tag}` });
  const id = () => randomUUID();
  const people = { sofia: id(), ana: id(), mei: id(), gone: id() };
  const rooms = { room3: id(), room5: id(), closed: id() };
  await db.insert(resource).values([
    { id: people.sofia, organizationId: business, name: "Sofia", kind: "person" },
    { id: people.ana, organizationId: business, name: "Ana", kind: "person" },
    { id: people.mei, organizationId: business, name: "Mei", kind: "person" },
    { id: people.gone, organizationId: business, name: "Gone", kind: "person", active: false },
    { id: rooms.room3, organizationId: business, name: "Room 3", kind: "place" },
    { id: rooms.room5, organizationId: business, name: "Room 5", kind: "place" },
    { id: rooms.closed, organizationId: business, name: "Room 6", kind: "place", active: false },
  ]);
  const services = { facial: id(), peel: id(), laser: id(), estimate: id(), retired: id() };
  await db.insert(bookingLink).values(
    Object.entries(services).map(([slug, serviceId]) => ({
      id: serviceId,
      organizationId: business,
      name: slug,
      slug,
      durationMinutes: 60,
      layout: "month",

      asksAddress: true,
      personChoice: "customer_picks",
      active: slug !== "retired",
    }))
  );
  const ticks: [string, string][] = [
    [services.facial, people.sofia],
    [services.facial, people.ana],
    [services.facial, people.mei],
    [services.facial, people.gone],
    [services.facial, rooms.room3],
    [services.facial, rooms.closed],
    [services.peel, rooms.room3],
    [services.laser, people.mei],
    [services.laser, rooms.room5],
  ];
  await db.insert(bookingLinkResource).values(
    ticks.map(([bookingLinkId, resourceId]) => ({
      organizationId: business,
      bookingLinkId,
      resourceId,
    }))
  );
  return { business, people, rooms, services };
}

const deactivate = (resourceId: string) =>
  db.update(resource).set({ active: false }).where(eq(resource.id, resourceId));

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-offer-%-${tag}`));
  await db.$client.end();
});

describe("findServiceResources", () => {
  test("nobody ticked: every active person, by name, and no room check", async () => {
    const { business, people, services } = await makeClinic("nobody");
    expect(await findServiceResources(business, services.estimate)).toEqual({
      peopleIds: [people.ana, people.mei, people.sofia],
      placeIds: null,
    });
  });

  test("people ticked: only those, inactive ones left out; places ticked: only the active ones", async () => {
    const { business, people, rooms, services } = await makeClinic("ticked");
    expect(await findServiceResources(business, services.facial)).toEqual({
      peopleIds: [people.ana, people.mei, people.sofia],
      placeIds: [rooms.room3],
    });
  });

  test("a person never shows as a place, nor a place as a person", async () => {
    const { business, rooms, services } = await makeClinic("kinds");
    const peel = await findServiceResources(business, services.peel);
    expect(peel).toEqual({ peopleIds: expect.any(Array), placeIds: [rooms.room3] });
    expect(peel!.peopleIds).not.toContain(rooms.room3);
  });

  test("the only ticked person inactive: nobody, never anyone", async () => {
    const { business, people, rooms, services } = await makeClinic("mei-left");
    await deactivate(people.mei);
    expect(await findServiceResources(business, services.laser)).toEqual({
      peopleIds: [],
      placeIds: [rooms.room5],
    });
  });

  test("the only ticked room inactive: a room is needed and none can be used", async () => {
    const { business, rooms, services } = await makeClinic("room-closed");
    await deactivate(rooms.room3);
    expect(await findServiceResources(business, services.peel)).toMatchObject({ placeIds: [] });
  });

  test("an inactive, missing or other business's service answers null", async () => {
    const mine = await makeClinic("mine");
    const theirs = await makeClinic("theirs");
    expect(await findServiceResources(mine.business, mine.services.retired)).toBeNull();
    expect(await findServiceResources(mine.business, randomUUID())).toBeNull();
    expect(await findServiceResources(mine.business, theirs.services.facial)).toBeNull();
  });

  test("a failure carries only a safe reason out, never the query's values", async () => {
    const { business, services } = await makeClinic("safe");
    const spy = vi.spyOn(db, "select").mockImplementationOnce(() => {
      throw new Error(`Failed query: select ... params: ${business}`, {
        cause: { code: "57014" },
      });
    });
    const error = await findServiceResources(business, services.facial).catch(
      (caught: Error) => caught
    );
    spy.mockRestore();
    expect((error as Error).message).toBe("Reading who does what failed: database error 57014");
  });
});
