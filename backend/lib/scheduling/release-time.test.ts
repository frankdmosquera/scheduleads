// Releasing time, against the local database. Every business here is a throwaway carrying this
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

assertLocalDevDatabase(process.env.DATABASE_URL, "run the release time tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { commitment, organization, resource } = await import("@scheduleads-app/shared/db");
const { holdTime } = await import("./hold-time.js");
const { releaseTime } = await import("./release-time.js");

const tag = randomUUID().slice(0, 8);

async function makeBusiness(name: string) {
  const business = randomUUID();
  await db.insert(organization).values({ id: business, name, slug: `test-release-${name}-${tag}` });
  const [ana, room] = [randomUUID(), randomUUID()];
  await db.insert(resource).values([
    { id: ana, organizationId: business, name: "Ana", kind: "person" },
    { id: room, organizationId: business, name: "Facial room", kind: "place" },
  ]);
  return { business, ana, room };
}

const at = (time: string) => new Date(`2026-10-07T${time}:00Z`);
const booking = (resourceIds: string[]) => ({
  resourceIds,
  startsAt: at("15:00"),
  endsAt: at("16:00"),
  kind: "booking" as const,
});

async function holdOrFail(business: string, resourceIds: string[]) {
  const result = await holdTime(business, booking(resourceIds));
  if (!result.held) throw new Error("expected the time to be free");
  return result.ids;
}

const statusOf = async (id: string) =>
  (await db.select().from(commitment).where(eq(commitment.id, id)))[0].status;

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-release-%-${tag}`));
  await db.$client.end();
});

describe("releaseTime", () => {
  test("a released hold frees the time, and its rows are kept as cancelled", async () => {
    const { business, ana, room } = await makeBusiness("free");
    const ids = await holdOrFail(business, [ana, room]);

    expect(await releaseTime(business, ids)).toBe(2);

    for (const id of ids) expect(await statusOf(id)).toBe("cancelled");
    expect(await holdTime(business, booking([ana, room]))).toMatchObject({ held: true });
  });

  test("releasing again changes nothing", async () => {
    const { business, ana } = await makeBusiness("twice");
    const ids = await holdOrFail(business, [ana]);
    await releaseTime(business, ids);
    expect(await releaseTime(business, ids)).toBe(0);
    expect(await releaseTime(business, [])).toBe(0);
  });

  test("another business's rows are never released", async () => {
    const mine = await makeBusiness("mine");
    const theirs = await makeBusiness("theirs");
    const theirIds = await holdOrFail(theirs.business, [theirs.ana]);

    expect(await releaseTime(mine.business, theirIds)).toBe(0);

    expect(await statusOf(theirIds[0])).toBe("active");
  });
});
