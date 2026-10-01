// Recording on a contact's timeline, against the local database. Every business here is a
// throwaway carrying this run's tag, removed after (its contacts and timeline go with it).

import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the activity tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { ACTIVITY_TYPES } = await import("@scheduleads-app/shared/crm");
const { activity, contact, organization, user } = await import("@scheduleads-app/shared/db");
const { findOrCreateContact } = await import("./find-or-create-contact.js");
const { recordActivity } = await import("./record-activity.js");

const tag = randomUUID().slice(0, 8);

async function makeBusiness(name: string) {
  const id = randomUUID();
  await db.insert(organization).values({ id, name, slug: `test-activity-${name}-${tag}` });
  return id;
}

// A business of its own with one contact, so no test depends on another having run.
async function businessWithContact(name: string) {
  const business = await makeBusiness(name);
  const { contact: maria } = await findOrCreateContact(business, {
    name: "Maria",
    email: `maria-${tag}@primo.example`,
  });
  return { business, contactId: maria.id };
}

const timelineOf = (contactId: string) =>
  db.select().from(activity).where(eq(activity.contactId, contactId));

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-activity-%-${tag}`));
  await db.delete(user).where(like(user.email, `activity-%-${tag}@example.com`));
  await db.$client.end();
});

describe("recordActivity", () => {
  test("records an entry with its type, payload, actor and time", async () => {
    const { business, contactId } = await businessWithContact("record");
    const actorUserId = randomUUID();
    await db
      .insert(user)
      .values({ id: actorUserId, name: "Owner", email: `activity-owner-${tag}@example.com` });
    const occurredAt = new Date("2026-10-02T15:00:00Z");

    const recorded = await recordActivity(business, {
      contactId,
      type: "booking_created",
      payload: { service: "Interior estimate" },
      actorUserId,
      occurredAt,
    });

    expect(await timelineOf(contactId)).toEqual([
      expect.objectContaining({
        id: recorded.id,
        organizationId: business,
        type: "booking_created",
        payload: { service: "Interior estimate" },
        actorUserId,
        occurredAt,
        dueAt: null,
        doneAt: null,
      }),
    ]);
  });

  test("with no time given, it happened now, by no one in particular", async () => {
    const { business, contactId } = await businessWithContact("now");
    const before = Date.now();
    await recordActivity(business, { contactId, type: "note" });
    const [entry] = await timelineOf(contactId);
    expect(entry.occurredAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(entry).toMatchObject({ actorUserId: null, payload: {} });
  });

  test("another business's contact is refused, and nothing is recorded", async () => {
    const mine = await businessWithContact("mine");
    const theirs = await businessWithContact("theirs");
    await expect(
      recordActivity(mine.business, { contactId: theirs.contactId, type: "note" })
    ).rejects.toThrow(/^Recording an activity failed: database error 23503$/);
    expect(await timelineOf(theirs.contactId)).toHaveLength(0);
  });

  test("a refused entry never carries its payload out", async () => {
    const { business } = await businessWithContact("private");
    const error = await recordActivity(business, {
      contactId: randomUUID(), // no such contact: Postgres refuses, and its error names the values
      type: "note",
      payload: { text: `private words ${tag}` },
    }).catch((caught: Error) => caught);
    expect((error as Error).message).toMatch(/^Recording an activity failed: database error/);
    expect((error as Error).message).not.toContain(`private words ${tag}`);
  });
});

describe("activity rules in the database", () => {
  const row = (organizationId: string, contactId: string, changes: Record<string, unknown>) => ({
    id: randomUUID(),
    organizationId,
    contactId,
    type: "task",
    ...changes,
  });
  const refusedBy = (constraint: string) => ({
    cause: { code: "23514", constraint_name: constraint },
  });

  test("every type in the shared list is accepted, so the two lists cannot drift", async () => {
    const { business, contactId } = await businessWithContact("types");
    for (const type of ACTIVITY_TYPES) {
      await db.insert(activity).values(row(business, contactId, { type, occurredAt: new Date() }));
    }
    const saved = (await timelineOf(contactId)).map((entry) => entry.type).sort();
    expect(saved).toEqual([...ACTIVITY_TYPES].sort());
  });

  test("a type outside the list is refused", async () => {
    const { business, contactId } = await businessWithContact("unknown");
    await expect(
      db.insert(activity).values(row(business, contactId, { type: "fax", occurredAt: new Date() }))
    ).rejects.toMatchObject(refusedBy("activity_type_check"));
  });

  test("a next step is accepted, and done once ticked off", async () => {
    const { business, contactId } = await businessWithContact("next");
    const dueAt = new Date("2026-10-08T16:00:00Z");
    await db.insert(activity).values(row(business, contactId, { dueAt }));
    await db.insert(activity).values(row(business, contactId, { dueAt, doneAt: new Date() }));
    expect(await timelineOf(contactId)).toHaveLength(2);
  });

  test("a row is happened or due, never both and never neither", async () => {
    const { business, contactId } = await businessWithContact("kinds");
    const now = new Date();
    await expect(
      db.insert(activity).values(row(business, contactId, { occurredAt: now, dueAt: now }))
    ).rejects.toMatchObject(refusedBy("activity_kind_check"));
    await expect(db.insert(activity).values(row(business, contactId, {}))).rejects.toMatchObject(
      refusedBy("activity_kind_check")
    );
  });

  test("done without being due is refused", async () => {
    const { business, contactId } = await businessWithContact("done");
    const now = new Date();
    await expect(
      db.insert(activity).values(row(business, contactId, { occurredAt: now, doneAt: now }))
    ).rejects.toMatchObject(refusedBy("activity_done_needs_due_check"));
  });

  test("deleting a contact takes its timeline with it", async () => {
    const { business, contactId } = await businessWithContact("gone");
    await recordActivity(business, { contactId, type: "note" });
    await db.delete(contact).where(eq(contact.id, contactId));
    expect(await timelineOf(contactId)).toHaveLength(0);
  });
});
