// The writers a booking uses, inside one transaction, against the local database. Every business
// here is a throwaway carrying this run's tag, removed after (its rows go with it).

import { randomUUID } from "node:crypto";

import { and, eq, like } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the transaction tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { activity, commitment, contact, organization, resource } =
  await import("@scheduleads-app/shared/db");
const { holdTime } = await import("../scheduling/hold-time.js");
const { releaseTime } = await import("../scheduling/release-time.js");
const { findOrCreateContact } = await import("../crm/find-or-create-contact.js");
const { recordActivity } = await import("../crm/record-activity.js");

const tag = randomUUID().slice(0, 8);
const at = (time: string) => new Date(`2026-10-05T${time}:00Z`);

// A business of its own with Ana and Mei, so no test depends on another having run.
async function makeBusiness(name: string) {
  const business = randomUUID();
  await db.insert(organization).values({ id: business, name, slug: `test-tx-${name}-${tag}` });
  const [ana, mei] = [randomUUID(), randomUUID()];
  await db.insert(resource).values([
    { id: ana, organizationId: business, name: "Ana", kind: "person" },
    { id: mei, organizationId: business, name: "Mei", kind: "person" },
  ]);
  return { business, ana, mei };
}

const timeOff = (resourceIds: string[], from: string, to: string) => ({
  resourceIds,
  startsAt: at(from),
  endsAt: at(to),
  kind: "time_off" as const,
});

const activeRowsOf = (resourceId: string) =>
  db
    .select()
    .from(commitment)
    .where(and(eq(commitment.resourceId, resourceId), eq(commitment.status, "active")));
const contactsOf = (business: string) =>
  db.select().from(contact).where(eq(contact.organizationId, business));
const activitiesOf = (business: string) =>
  db.select().from(activity).where(eq(activity.organizationId, business));

// Thrown on purpose to roll a transaction back.
class RollBackError extends Error {}

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-tx-%-${tag}`));
  await db.$client.end();
});

describe("writing as one transaction", () => {
  test("inside a transaction, a taken hold answers not held and the transaction still saves the rest", async () => {
    const { business, ana, mei } = await makeBusiness("taken");
    await holdTime(business, timeOff([mei], "15:00", "16:00")); // Mei taken first

    const answers = await db.transaction(async (tx) => {
      const { contact: jane } = await findOrCreateContact(
        business,
        { name: "Jane", email: `jane-${tag}@example.com` },
        tx
      );
      const meiHold = await holdTime(business, timeOff([mei], "15:30", "16:30"), tx);
      const anaHold = await holdTime(business, timeOff([ana], "15:30", "16:30"), tx); // still usable
      await recordActivity(business, { contactId: jane.id, type: "note" }, tx);
      return { meiHold, anaHold };
    });

    expect(answers.meiHold).toEqual({ held: false });
    expect(answers.anaHold).toEqual({ held: true, ids: [expect.any(String)] });
    expect(await activeRowsOf(ana)).toHaveLength(1);
    expect(await activeRowsOf(mei)).toHaveLength(1); // only the first, never the refused one
    expect(await contactsOf(business)).toHaveLength(1);
    expect(await activitiesOf(business)).toHaveLength(1);
  });

  test("a rolled-back transaction leaves no commitment, contact or timeline entry", async () => {
    const { business, ana } = await makeBusiness("rolled-back");

    await expect(
      db.transaction(async (tx) => {
        const { contact: jane } = await findOrCreateContact(business, { name: "Jane" }, tx);
        await holdTime(business, timeOff([ana], "15:00", "16:00"), tx);
        await recordActivity(business, { contactId: jane.id, type: "note" }, tx);
        throw new RollBackError();
      })
    ).rejects.toBeInstanceOf(RollBackError);

    expect(await activeRowsOf(ana)).toHaveLength(0);
    expect(await contactsOf(business)).toHaveLength(0);
    expect(await activitiesOf(business)).toHaveLength(0);
  });

  test("each writer writes nothing outside the transaction it was given", async () => {
    const { business, ana, mei } = await makeBusiness("inside");
    const before = await holdTime(business, timeOff([mei], "09:00", "10:00"));
    if (!before.held) throw new Error("the setup hold was refused");

    let seenOutside: number[] = [];
    await db.transaction(async (tx) => {
      const { contact: jane } = await findOrCreateContact(business, { name: "Jane" }, tx);
      await holdTime(business, timeOff([ana], "15:00", "16:00"), tx);
      await recordActivity(business, { contactId: jane.id, type: "note" }, tx);
      expect(await releaseTime(business, before.ids, tx)).toBe(1);
      // The shared pool is another connection: it sees none of it until the commit.
      seenOutside = [
        (await contactsOf(business)).length,
        (await activeRowsOf(ana)).length,
        (await activitiesOf(business)).length,
        (await activeRowsOf(mei)).length, // still active outside: the release is not committed
      ];
    });

    expect(seenOutside).toEqual([0, 0, 0, 1]);
    expect(await contactsOf(business)).toHaveLength(1);
    expect(await activeRowsOf(ana)).toHaveLength(1);
    expect(await activitiesOf(business)).toHaveLength(1);
    expect(await activeRowsOf(mei)).toHaveLength(0);
  });
});
