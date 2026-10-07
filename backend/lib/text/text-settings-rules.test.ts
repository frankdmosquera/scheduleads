// The text_settings table's rules, proved by inserting rows directly into the local database.
// Every business here is a throwaway carrying this run's tag, removed after (its rows go with it).

import { randomInt, randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the text settings tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { organization, textSettings } = await import("@scheduleads-app/shared/db");

const tag = randomUUID().slice(0, 8);

async function makeBusiness(name: string) {
  const id = randomUUID();
  await db.insert(organization).values({ id, name, slug: `test-text-${name}-${tag}` });
  return id;
}

// A made-up number of its own per row, so rows from runs side by side never share one.
const freshNumber = () =>
  `+1587${randomInt(200, 1000)}${String(randomInt(0, 10_000)).padStart(4, "0")}`;

const settingsRow = (organizationId: string, changes: Record<string, unknown> = {}) => ({
  organizationId,
  fromNumber: freshNumber(),
  confirmationOn: true,
  reminderMinutesBefore: [1200, 60],
  replyPhone: "+14035550100",
  replyEmail: null,
  ...changes,
});

const refusedBy = (code: string, constraint: string) => ({
  cause: { code, constraint_name: constraint },
});
const CHECK = "23514";
const UNIQUE = "23505";
const NOT_NULL = "23502";

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-text-%-${tag}`));
  await db.$client.end();
});

describe("text settings rules in the database", () => {
  test("a business's choices are saved as given, and go with the business", async () => {
    const business = await makeBusiness("saved");
    const row = settingsRow(business, { replyEmail: "office@primo.com" });
    await db.insert(textSettings).values(row);

    const [saved] = await db
      .select()
      .from(textSettings)
      .where(eq(textSettings.organizationId, business));
    expect(saved).toMatchObject({
      fromNumber: row.fromNumber,
      confirmationOn: true,
      reminderMinutesBefore: [1200, 60],
      replyPhone: "+14035550100",
      replyEmail: "office@primo.com",
    });

    await db.delete(organization).where(eq(organization.id, business));
    const left = await db
      .select()
      .from(textSettings)
      .where(eq(textSettings.organizationId, business));
    expect(left).toHaveLength(0);
  });

  test("no reminder at all, and replies only by email, are allowed", async () => {
    const business = await makeBusiness("no-reminder");
    await expect(
      db.insert(textSettings).values(
        settingsRow(business, {
          reminderMinutesBefore: [],
          replyPhone: null,
          replyEmail: "office@primo.com",
        })
      )
    ).resolves.toBeDefined();
  });

  test("a row with nowhere for replies to go is refused", async () => {
    const business = await makeBusiness("no-reply");
    await expect(
      db.insert(textSettings).values(settingsRow(business, { replyPhone: null, replyEmail: null }))
    ).rejects.toMatchObject(refusedBy(CHECK, "text_settings_reply_destination_check"));
  });

  test.each([
    ["no minutes", [0]],
    ["after the start", [1200, -30]],
  ])("a reminder of %s is refused", async (name, reminderMinutesBefore) => {
    const business = await makeBusiness(`reminder-${name.replace(/\W+/g, "-")}`);
    await expect(
      db.insert(textSettings).values(settingsRow(business, { reminderMinutesBefore }))
    ).rejects.toMatchObject(refusedBy(CHECK, "text_settings_reminder_minutes_check"));
  });

  test("one number for two businesses is refused: a reply could not tell them apart", async () => {
    const first = await makeBusiness("first");
    const second = await makeBusiness("second");
    const row = settingsRow(first);
    await db.insert(textSettings).values(row);

    await expect(
      db.insert(textSettings).values(settingsRow(second, { fromNumber: row.fromNumber }))
    ).rejects.toMatchObject(refusedBy(UNIQUE, "text_settings_fromNumber_unique"));
  });

  test.each([
    [
      "a texting number Twilio could not use",
      { fromNumber: "4035550199" },
      "text_settings_from_number_check",
    ],
    [
      "a reply phone Twilio could not use",
      { replyPhone: "403-555-0100" },
      "text_settings_reply_phone_check",
    ],
  ])("%s is refused", async (_, changes, constraint) => {
    const business = await makeBusiness(`shape-${constraint}`);
    await expect(
      db.insert(textSettings).values(settingsRow(business, changes))
    ).rejects.toMatchObject(refusedBy(CHECK, constraint));
  });

  test("replies to the texting number itself are refused: they would come straight back", async () => {
    const business = await makeBusiness("loop");
    const row = settingsRow(business);
    await expect(
      db.insert(textSettings).values({ ...row, replyPhone: row.fromNumber })
    ).rejects.toMatchObject(refusedBy(CHECK, "text_settings_reply_phone_check"));
  });

  test("the confirmation must be chosen, on or off: there is no default", async () => {
    const business = await makeBusiness("unchosen");
    const { confirmationOn: _, ...unchosen } = settingsRow(business);
    await expect(
      db.insert(textSettings).values(unchosen as typeof textSettings.$inferInsert)
    ).rejects.toMatchObject({ cause: { code: NOT_NULL } });
  });
});
