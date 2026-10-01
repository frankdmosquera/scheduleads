// Reading who is taken, against the local database. Every business here is a throwaway
// carrying this run's tag, removed after (its people, places and commitments go with it).

import { randomUUID } from "node:crypto";

import { like } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the find commitments tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { organization, resource } = await import("@scheduleads-app/shared/db");
const { findCommitments } = await import("./find-commitments.js");
const { holdTime } = await import("./hold-time.js");
const { releaseTime } = await import("./release-time.js");

const tag = randomUUID().slice(0, 8);

async function makeBusiness(name: string) {
  const business = randomUUID();
  await db.insert(organization).values({ id: business, name, slug: `test-find-${name}-${tag}` });
  const [ana, luis, room] = [randomUUID(), randomUUID(), randomUUID()];
  await db.insert(resource).values([
    { id: ana, organizationId: business, name: "Ana", kind: "person" },
    { id: luis, organizationId: business, name: "Luis", kind: "person" },
    { id: room, organizationId: business, name: "Facial room", kind: "place" },
  ]);
  return { business, ana, luis, room };
}

const at = (time: string) => new Date(`2026-10-08T${time}:00Z`);

async function hold(
  business: string,
  resourceIds: string[],
  from: string,
  to: string,
  kind: "booking" | "time_off" = "booking"
) {
  const result = await holdTime(business, {
    resourceIds,
    startsAt: at(from),
    endsAt: at(to),
    kind,
  });
  if (!result.held) throw new Error("expected the time to be free");
  return result.ids;
}

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-find-%-${tag}`));
  await db.$client.end();
});

describe("findCommitments", () => {
  test("answers exactly the active rows touching the stretch, ordered by start", async () => {
    const { business, ana, room } = await makeBusiness("exact");
    const [beforeEdge] = await hold(business, [ana], "08:00", "12:00"); // ends as it starts
    // Saved out of order, so only the ordering puts them by start.
    const [overlapsEnd] = await hold(business, [ana], "16:30", "18:00");
    const [inside] = await hold(business, [room], "14:00", "15:00", "time_off");
    const [overlapsStart] = await hold(business, [ana], "12:00", "13:30");
    const [afterEdge] = await hold(business, [room], "17:00", "19:00"); // starts as it ends
    const [cancelled] = await hold(business, [room], "15:00", "16:00");
    await releaseTime(business, [cancelled]);

    const found = await findCommitments(business, [ana, room], at("13:00"), at("17:00"));

    expect(found.map((row) => row.id)).toEqual([overlapsStart, inside, overlapsEnd]);
    expect(found).not.toContainEqual(expect.objectContaining({ id: beforeEdge }));
    expect(found).not.toContainEqual(expect.objectContaining({ id: afterEdge }));
    expect(found[1]).toEqual({
      id: inside,
      resourceId: room,
      kind: "time_off",
      bookingId: null,
      startsAt: at("14:00"),
      endsAt: at("15:00"),
    });
  });

  test("a stretch wholly inside one row finds it", async () => {
    const { business, ana } = await makeBusiness("inside");
    const [allDay] = await hold(business, [ana], "08:00", "18:00", "time_off");
    const found = await findCommitments(business, [ana], at("10:00"), at("11:00"));
    expect(found.map((row) => row.id)).toEqual([allDay]);
  });

  test("only the people and places asked about", async () => {
    const { business, ana, luis } = await makeBusiness("asked");
    await hold(business, [luis], "10:00", "11:00");
    expect(await findCommitments(business, [ana], at("09:00"), at("12:00"))).toEqual([]);
    expect(await findCommitments(business, [], at("09:00"), at("12:00"))).toEqual([]);
  });

  test("another business's rows are never found", async () => {
    const mine = await makeBusiness("mine");
    const theirs = await makeBusiness("theirs");
    await hold(theirs.business, [theirs.ana], "10:00", "11:00");
    expect(await findCommitments(mine.business, [theirs.ana], at("09:00"), at("12:00"))).toEqual(
      []
    );
  });

  test("a failure carries only a safe reason out", async () => {
    const { business, ana } = await makeBusiness("safe");
    // a stretch ending before it starts: Postgres refuses the range
    await expect(findCommitments(business, [ana], at("12:00"), at("09:00"))).rejects.toThrow(
      /^Reading time failed: database error \w+$/
    );
  });
});
