// The worker_text_settings table's rules, proved by inserting rows directly into the local
// database. Every business here is a throwaway carrying this run's tag, removed after (its people
// and their rows go with it).

import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the worker text settings tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { organization, resource, workerTextSettings } = await import("@scheduleads-app/shared/db");

const tag = randomUUID().slice(0, 8);

// A business with one person, Pedro.
async function makeBusiness(name: string) {
  const organizationId = randomUUID();
  await db
    .insert(organization)
    .values({ id: organizationId, name, slug: `test-worker-text-${name}-${tag}` });
  const personId = randomUUID();
  await db.insert(resource).values({ id: personId, organizationId, name: "Pedro" });
  return { organizationId, personId };
}

const settingsRow = (
  ids: { organizationId: string; personId: string },
  changes: Record<string, unknown> = {}
) => ({
  ...ids,
  phone: "+14035550161",
  addedOn: true,
  movedOn: false,
  removedOn: true,
  ...changes,
});

const refusedBy = (code: string, constraint: string) => ({
  cause: { code, constraint_name: constraint },
});
const CHECK = "23514";
const FOREIGN_KEY = "23503";
const NOT_NULL = "23502";

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-worker-text-%-${tag}`));
  await db.$client.end();
});

describe("worker text settings rules in the database", () => {
  test("a person's choices are saved as given, and go with the person", async () => {
    const ids = await makeBusiness("saved");
    await db.insert(workerTextSettings).values(settingsRow(ids));

    const [saved] = await db
      .select()
      .from(workerTextSettings)
      .where(eq(workerTextSettings.personId, ids.personId));
    expect(saved).toMatchObject({
      organizationId: ids.organizationId,
      phone: "+14035550161",
      addedOn: true,
      movedOn: false,
      removedOn: true,
    });

    await db.delete(resource).where(eq(resource.id, ids.personId));
    const left = await db
      .select()
      .from(workerTextSettings)
      .where(eq(workerTextSettings.personId, ids.personId));
    expect(left).toHaveLength(0);
  });

  test("two people may share one phone", async () => {
    const first = await makeBusiness("share-first");
    const second = await makeBusiness("share-second");
    await db.insert(workerTextSettings).values(settingsRow(first));
    await expect(db.insert(workerTextSettings).values(settingsRow(second))).resolves.toBeDefined();
  });

  test.each([["4035550161"], ["403-555-0161"], ["+14031550161"]])(
    "a phone stored as %s is refused: Twilio could not text it",
    async (phone) => {
      const ids = await makeBusiness(`shape-${phone.replace(/\W/g, "x")}`);
      await expect(
        db.insert(workerTextSettings).values(settingsRow(ids, { phone }))
      ).rejects.toMatchObject(refusedBy(CHECK, "worker_text_settings_phone_check"));
    }
  );

  test("a row pointing at another business's person is refused", async () => {
    const mine = await makeBusiness("mine");
    const theirs = await makeBusiness("theirs");
    await expect(
      db
        .insert(workerTextSettings)
        .values(settingsRow({ organizationId: mine.organizationId, personId: theirs.personId }))
    ).rejects.toMatchObject(refusedBy(FOREIGN_KEY, "worker_text_settings_person_fk"));
  });

  test.each([["addedOn"], ["movedOn"], ["removedOn"]])(
    "%s must be chosen, on or off: there is no default",
    async (name) => {
      const ids = await makeBusiness(`unchosen-${name}`);
      const { [name as "addedOn"]: _, ...unchosen } = settingsRow(ids);
      await expect(
        db.insert(workerTextSettings).values(unchosen as typeof workerTextSettings.$inferInsert)
      ).rejects.toMatchObject({ cause: { code: NOT_NULL } });
    }
  );
});
