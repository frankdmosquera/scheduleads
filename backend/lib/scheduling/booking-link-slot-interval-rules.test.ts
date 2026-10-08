// The start-time step's rule, proved by inserting services directly into the local database.
// Every business here is a throwaway carrying this run's tag, removed after (its services go
// with it).

import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the start-time step tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { bookingLink, organization } = await import("@scheduleads-app/shared/db");

const tag = randomUUID().slice(0, 8);
const business = randomUUID();

const peel = (slotIntervalMinutes: number | undefined) => ({
  id: randomUUID(),
  organizationId: business,
  name: "Chemical Peel",
  slug: `chemical-peel-${randomUUID().slice(0, 8)}`,
  durationMinutes: 30,
  layout: "month" as const,
  personChoice: "business_assigns" as const,
  ...(slotIntervalMinutes === undefined ? {} : { slotIntervalMinutes }),
});

const refusedBy = (code: string, constraint: string) => ({
  cause: { code, constraint_name: constraint },
});

const stepOf = async (id: string) =>
  (
    await db
      .select({ slotIntervalMinutes: bookingLink.slotIntervalMinutes })
      .from(bookingLink)
      .where(eq(bookingLink.id, id))
  )[0]?.slotIntervalMinutes;

beforeAll(async () => {
  await db.insert(organization).values({ id: business, name: "Step", slug: `test-step-${tag}` });
});

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-step-${tag}`));
  await db.$client.end();
});

describe("the start-time step in the database", () => {
  test("left out, it is empty: start times every service length", async () => {
    const service = peel(undefined);
    await db.insert(bookingLink).values(service);
    expect(await stepOf(service.id)).toBeNull();
  });

  test("15 is stored", async () => {
    const service = peel(15);
    await db.insert(bookingLink).values(service);
    expect(await stepOf(service.id)).toBe(15);
  });

  test.each([0, -5])("%i is refused", async (minutes) => {
    await expect(db.insert(bookingLink).values(peel(minutes))).rejects.toMatchObject(
      refusedBy("23514", "booking_link_slot_interval_check")
    );
  });
});
