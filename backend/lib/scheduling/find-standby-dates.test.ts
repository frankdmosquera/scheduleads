// Who is on standby over a range of dates, against the local database. Every business here is
// a throwaway carrying this run's tag, removed after (its people and standby dates go with it).

import { randomUUID } from "node:crypto";

import { like } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the standby reading tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { organization, resource, standbyDate } = await import("@scheduleads-app/shared/db");
const { findStandbyDates } = await import("./find-standby-dates.js");

const tag = randomUUID().slice(0, 8);

// A business of its own: Sofia on standby on four Mondays, Ana on one, Luis never.
async function makeBusiness(name: string) {
  const business = randomUUID();
  await db
    .insert(organization)
    .values({ id: business, name, slug: `test-standby-read-${name}-${tag}` });
  const [sofia, ana, luis] = [randomUUID(), randomUUID(), randomUUID()];
  await db.insert(resource).values([
    { id: sofia, organizationId: business, name: "Sofia", kind: "person" },
    { id: ana, organizationId: business, name: "Ana", kind: "person" },
    { id: luis, organizationId: business, name: "Luis", kind: "person" },
  ]);
  await db.insert(standbyDate).values([
    { organizationId: business, resourceId: sofia, date: "2026-10-05" }, // before the range tested
    { organizationId: business, resourceId: sofia, date: "2026-10-12" },
    { organizationId: business, resourceId: sofia, date: "2026-10-19" },
    { organizationId: business, resourceId: sofia, date: "2026-10-26" },
    { organizationId: business, resourceId: ana, date: "2026-10-19" },
  ]);
  return { business, sofia, ana, luis };
}

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-standby-read-%-${tag}`));
  await db.$client.end();
});

describe("findStandbyDates", () => {
  test("exactly the dates inside the range, both ends included, by date then person", async () => {
    const { business, sofia, ana, luis } = await makeBusiness("range");
    const found = await findStandbyDates(business, [sofia, ana, luis], "2026-10-12", "2026-10-19");
    const ordered = [sofia, ana].sort();
    expect(found).toEqual([
      { resourceId: sofia, date: "2026-10-12" },
      { resourceId: ordered[0], date: "2026-10-19" },
      { resourceId: ordered[1], date: "2026-10-19" },
    ]);
  });

  test("only the people asked about", async () => {
    const { business, ana, luis } = await makeBusiness("asked");
    expect(await findStandbyDates(business, [ana, luis], "2026-10-01", "2026-10-31")).toEqual([
      { resourceId: ana, date: "2026-10-19" },
    ]);
    expect(await findStandbyDates(business, [], "2026-10-01", "2026-10-31")).toEqual([]);
  });

  test("never another business's dates", async () => {
    const mine = await makeBusiness("mine");
    const theirs = await makeBusiness("theirs");
    expect(
      await findStandbyDates(mine.business, [theirs.sofia], "2026-10-01", "2026-10-31")
    ).toEqual([]);
  });

  test("a failure carries only a safe reason out", async () => {
    const { business, sofia } = await makeBusiness("safe");
    await expect(findStandbyDates(business, [sofia], "2026-13-45", "2026-10-31")).rejects.toThrow(
      /^Reading standby failed: database error \w+$/
    );
  });
});
