// The standby dates' rules, proved by inserting rows directly into the local database. Every
// business here is a throwaway carrying this run's tag, removed after (its people and standby
// dates go with it).

import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the standby tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { organization, resource, standbyDate } = await import("@scheduleads-app/shared/db");

const tag = randomUUID().slice(0, 8);

// A business of its own with two practitioners, so no test depends on another having run.
async function makeBusiness(name: string) {
  const business = randomUUID();
  await db.insert(organization).values({ id: business, name, slug: `test-standby-${name}-${tag}` });
  const [sofia, ana] = [randomUUID(), randomUUID()];
  await db.insert(resource).values([
    { id: sofia, organizationId: business, name: "Sofia", kind: "person" },
    { id: ana, organizationId: business, name: "Ana", kind: "person" },
  ]);
  return { business, sofia, ana };
}

const monday = "2026-10-12";

const refusedBy = (code: string, constraint: string) => ({
  cause: { code, constraint_name: constraint },
});

const datesOf = (resourceId: string) =>
  db.select().from(standbyDate).where(eq(standbyDate.resourceId, resourceId));

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-standby-%-${tag}`));
  await db.$client.end();
});

describe("standby rules in the database", () => {
  test("a person can be on standby on a date, kept as that calendar date", async () => {
    const { business, sofia } = await makeBusiness("standby");
    await db
      .insert(standbyDate)
      .values({ organizationId: business, resourceId: sofia, date: monday });
    expect(await datesOf(sofia)).toEqual([
      expect.objectContaining({ organizationId: business, resourceId: sofia, date: monday }),
    ]);
  });

  test("the same person twice on one date is refused", async () => {
    const { business, sofia } = await makeBusiness("twice");
    const row = { organizationId: business, resourceId: sofia, date: monday };
    await db.insert(standbyDate).values(row);
    await expect(db.insert(standbyDate).values(row)).rejects.toMatchObject(
      refusedBy("23505", "standby_date_pkey")
    );
  });

  test("two people on standby on one date are fine", async () => {
    const { business, sofia, ana } = await makeBusiness("two");
    await db.insert(standbyDate).values([
      { organizationId: business, resourceId: sofia, date: monday },
      { organizationId: business, resourceId: ana, date: monday },
    ]);
    expect(await datesOf(sofia)).toHaveLength(1);
    expect(await datesOf(ana)).toHaveLength(1);
  });

  test("another business's person is refused", async () => {
    const mine = await makeBusiness("mine");
    const theirs = await makeBusiness("theirs");
    await expect(
      db
        .insert(standbyDate)
        .values({ organizationId: mine.business, resourceId: theirs.sofia, date: monday })
    ).rejects.toMatchObject(refusedBy("23503", "standby_date_resource_fk"));
    expect(await datesOf(theirs.sofia)).toHaveLength(0);
  });

  test("deleting a person takes their standby dates", async () => {
    const { business, sofia } = await makeBusiness("person-gone");
    await db
      .insert(standbyDate)
      .values({ organizationId: business, resourceId: sofia, date: monday });
    await db.delete(resource).where(eq(resource.id, sofia));
    expect(await datesOf(sofia)).toHaveLength(0);
  });

  test("deleting the whole business takes its standby dates", async () => {
    const { business, sofia, ana } = await makeBusiness("gone");
    await db.insert(standbyDate).values([
      { organizationId: business, resourceId: sofia, date: monday },
      { organizationId: business, resourceId: ana, date: monday },
    ]);
    await db.delete(organization).where(eq(organization.id, business));
    expect(await datesOf(sofia)).toHaveLength(0);
    expect(await datesOf(ana)).toHaveLength(0);
  });
});
