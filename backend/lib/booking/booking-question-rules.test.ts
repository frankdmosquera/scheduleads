// A business's own booking questions (feature 9, decision 5), proved by inserting them directly into
// the local database. The business is a throwaway carrying this run's tag, removed after (its
// questions go with it).

import { randomUUID } from "node:crypto";

import { like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the booking question tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { bookingQuestion, organization } = await import("@scheduleads-app/shared/db");

const tag = randomUUID().slice(0, 8);
const business = randomUUID();

const question = (label: string) => ({
  id: randomUUID(),
  organizationId: business,
  position: 1,
  label,
  required: true,
});

beforeAll(async () => {
  await db
    .insert(organization)
    .values({ id: business, name: "Questions", slug: `test-questions-${tag}` });
});

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-questions-${tag}`));
  await db.$client.end();
});

describe("a booking question's words, in the database", () => {
  test("one to 200 characters are stored", async () => {
    await expect(db.insert(bookingQuestion).values(question("Pets?"))).resolves.toBeDefined();
    await expect(
      db.insert(bookingQuestion).values(question("a".repeat(200)))
    ).resolves.toBeDefined();
  });

  test.each([
    ["empty", ""],
    ["201 characters", "a".repeat(201)],
    ["spaces around it", " Pets? "],
  ])("%s is refused", async (_name, label) => {
    await expect(db.insert(bookingQuestion).values(question(label))).rejects.toMatchObject({
      cause: { code: "23514", constraint_name: "booking_question_label_check" },
    });
  });
});
