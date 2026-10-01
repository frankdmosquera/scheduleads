// Holding time, against the local database. Every business here is a throwaway carrying this
// run's tag, removed after (its people, places and commitments go with it).

import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the hold time tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { commitment, organization, resource } = await import("@scheduleads-app/shared/db");
const { holdTime } = await import("./hold-time.js");

const tag = randomUUID().slice(0, 8);

// A business of its own with a practitioner, a second one and a room, so no test depends on
// another having run.
async function makeBusiness(name: string) {
  const business = randomUUID();
  await db.insert(organization).values({ id: business, name, slug: `test-hold-${name}-${tag}` });
  const [ana, luis, room] = [randomUUID(), randomUUID(), randomUUID()];
  await db.insert(resource).values([
    { id: ana, organizationId: business, name: "Ana", kind: "person" },
    { id: luis, organizationId: business, name: "Luis", kind: "person" },
    { id: room, organizationId: business, name: "Facial room", kind: "place" },
  ]);
  return { business, ana, luis, room };
}

const at = (time: string) => new Date(`2026-10-06T${time}:00Z`);
const booking = (resourceIds: string[], from: string, to: string) => ({
  resourceIds,
  startsAt: at(from),
  endsAt: at(to),
  kind: "booking" as const,
});

const rowsOf = (resourceId: string) =>
  db.select().from(commitment).where(eq(commitment.resourceId, resourceId));

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-hold-%-${tag}`));
  await db.$client.end();
});

describe("holdTime", () => {
  test("a booking's person and place are held together", async () => {
    const { business, ana, room } = await makeBusiness("together");
    const bookingId = randomUUID();

    const result = await holdTime(business, {
      ...booking([ana, room], "15:00", "16:00"),
      bookingId,
    });

    expect(result).toEqual({ held: true, ids: [expect.any(String), expect.any(String)] });
    for (const resourceId of [ana, room]) {
      expect(await rowsOf(resourceId)).toEqual([
        expect.objectContaining({
          organizationId: business,
          kind: "booking",
          bookingId,
          startsAt: at("15:00"),
          endsAt: at("16:00"),
          status: "active",
        }),
      ]);
    }
  });

  test("if either is taken, neither is held and the answer is taken", async () => {
    const { business, ana, room } = await makeBusiness("all-or-none");
    await holdTime(business, booking([room], "15:30", "16:30"));

    expect(await holdTime(business, booking([ana, room], "15:00", "16:00"))).toEqual({
      held: false,
    });
    expect(await rowsOf(ana)).toHaveLength(0);
    expect(await rowsOf(room)).toHaveLength(1);
  });

  test("time off is held the same way, and blocks a booking", async () => {
    const { business, ana } = await makeBusiness("time-off");
    const off = await holdTime(business, { ...booking([ana], "09:00", "17:00"), kind: "time_off" });
    expect(off).toMatchObject({ held: true });
    expect(await holdTime(business, booking([ana], "15:00", "16:00"))).toEqual({ held: false });
  });

  test("two holds for the same time at the same instant give one held and one taken", async () => {
    const { business, ana, luis, room } = await makeBusiness("race");
    const results = await Promise.all([
      holdTime(business, booking([ana, room], "15:00", "16:00")),
      holdTime(business, booking([luis, room], "15:00", "16:00")),
    ]);
    expect(results.filter((result) => result.held)).toHaveLength(1);
    expect(results.filter((result) => !result.held)).toHaveLength(1);
    expect(await rowsOf(room)).toHaveLength(1);
    expect((await rowsOf(ana)).length + (await rowsOf(luis)).length).toBe(1);
  });

  test("another business's person is refused as not theirs, busy or free, never as taken", async () => {
    const mine = await makeBusiness("mine");
    const theirs = await makeBusiness("theirs");
    await holdTime(theirs.business, booking([theirs.ana], "15:00", "16:00"));

    for (const from of ["15:00", "10:00"]) {
      // 15:00 is when their person is busy, 10:00 when free: the same refusal either way
      await expect(
        holdTime(mine.business, booking([mine.ana, theirs.ana], from, "16:00"))
      ).rejects.toThrow(/^Holding time failed: database error 23503$/);
    }
    expect(await rowsOf(mine.ana)).toHaveLength(0);
    expect(await rowsOf(theirs.ana)).toHaveLength(1);
  });

  test("no person or place, or one given twice, is refused before the database", async () => {
    const { business, ana } = await makeBusiness("input");
    await expect(holdTime(business, booking([], "15:00", "16:00"))).rejects.toThrow(
      "Holding time failed: no person or place given"
    );
    await expect(holdTime(business, booking([ana, ana], "15:00", "16:00"))).rejects.toThrow(
      "Holding time failed: the same person or place given twice"
    );
    expect(await rowsOf(ana)).toHaveLength(0);
  });

  test("a refused hold carries only a safe reason out, never the query's values", async () => {
    const { business, ana } = await makeBusiness("safe");
    const bookingId = `private-${tag}`;
    const error = await holdTime(business, {
      ...booking([ana], "16:00", "15:00"), // ends before it starts: the database refuses it
      bookingId,
    }).catch((caught: Error) => caught);
    expect((error as Error).message).toBe("Holding time failed: database error 23514");
    expect((error as Error).message).not.toContain(bookingId);
    expect((error as Error).message).not.toContain(ana);
  });
});
