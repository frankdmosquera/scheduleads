// Whose calendar calendar:check reads, against the local seeded database (npm run db:seed).
// Every login and business made here is a throwaway, removed after.

import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url)); // the root .env, before the code reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the calendar:check tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../database.js");
const { organization, resource, user } = await import("@scheduleads-app/shared/db");
const { findCalendarCheckTarget } = await import("./find-calendar-check-target.js");

const tag = randomUUID().slice(0, 8);
const noHoursBusiness = { id: randomUUID(), slug: `test-check-no-hours-${tag}-dev` };
const secondBusiness = { id: randomUUID(), slug: `test-check-second-${tag}-dev` };
const login = (letter: string) => ({
  id: randomUUID(),
  email: `check-${letter}-${tag}@example.com`,
});
const inNoHours = login("a"); // a person in a business with no hours
const inTwo = login("b"); // a person in two businesses
const noPerson = login("c"); // a login that is nobody's person

beforeAll(async () => {
  await db.insert(user).values(
    [inNoHours, inTwo, noPerson].map((l) => ({
      id: l.id,
      name: "",
      email: l.email,
      emailVerified: true,
    }))
  );
  await db
    .insert(organization)
    .values(
      [noHoursBusiness, secondBusiness].map((b) => ({ id: b.id, name: b.slug, slug: b.slug }))
    );
  await db.insert(resource).values([
    {
      id: randomUUID(),
      organizationId: noHoursBusiness.id,
      name: "Ana",
      kind: "person",
      userId: inNoHours.id,
    },
    {
      id: randomUUID(),
      organizationId: noHoursBusiness.id,
      name: "Ben",
      kind: "person",
      userId: inTwo.id,
    },
    {
      id: randomUUID(),
      organizationId: secondBusiness.id,
      name: "Ben",
      kind: "person",
      userId: inTwo.id,
    },
  ]);
});

afterAll(async () => {
  await db
    .delete(organization)
    .where(inArray(organization.id, [noHoursBusiness.id, secondBusiness.id]));
  await db.delete(user).where(inArray(user.id, [inNoHours.id, inTwo.id, noPerson.id]));
  await db.$client.end();
});

describe("findCalendarCheckTarget", () => {
  test("the seeded admin is their person in Summit Painting, in its Edmonton time zone", async () => {
    const target = await findCalendarCheckTarget("admin@example.com");
    expect(target.businessName).toBe("Summit Painting (dev)");
    expect(target.timezone).toBe("America/Edmonton");
  });

  test("a business with no hours is refused rather than printed at a guessed hour", async () => {
    await expect(findCalendarCheckTarget(inNoHours.email)).rejects.toThrow(
      `${noHoursBusiness.slug} has no hours set, so it has no time zone to print the times in.`
    );
  });

  test("a login that is nobody's person is refused", async () => {
    await expect(findCalendarCheckTarget(noPerson.email)).rejects.toThrow(
      "is not a person in any business"
    );
  });

  test("a login that is a person in two businesses is refused, naming both", async () => {
    await expect(findCalendarCheckTarget(inTwo.email)).rejects.toThrow(
      `is a person in more than one business`
    );
  });

  test("an unknown address is refused", async () => {
    await expect(findCalendarCheckTarget(`nobody-${tag}@example.com`)).rejects.toThrow(
      "There is no login with the address"
    );
  });
});
