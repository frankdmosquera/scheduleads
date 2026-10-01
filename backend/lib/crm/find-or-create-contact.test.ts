// Finding or making a contact, against the local database. Every business here is a throwaway
// carrying this run's tag, removed after (its contacts go with it).

import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the contact tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { contact, organization } = await import("@scheduleads-app/shared/db");
const { findOrCreateContact } = await import("./find-or-create-contact.js");

const tag = randomUUID().slice(0, 8);
const makeBusiness = async (name: string) => {
  const id = randomUUID();
  await db.insert(organization).values({ id, name, slug: `test-contacts-${name}-${tag}` });
  return id;
};
const contactsOf = (organizationId: string) =>
  db.select().from(contact).where(eq(contact.organizationId, organizationId));

let primo = "";
let clinic = "";

beforeAll(async () => {
  primo = await makeBusiness("primo");
  clinic = await makeBusiness("clinic");
});

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-contacts-%-${tag}`));
  await db.$client.end();
});

describe("findOrCreateContact", () => {
  test("a new email makes a contact, stored trimmed and lowercased", async () => {
    const { contact: made, created } = await findOrCreateContact(primo, {
      name: " Maria Lopez ",
      email: " Maria@Primo.Example ",
      phone: " 403 555 0101 ",
    });
    expect(created).toBe(true);
    expect(made).toMatchObject({
      name: "Maria Lopez",
      email: "maria@primo.example",
      phone: "403 555 0101",
    });
  });

  test("the same email again is the same contact, its first name and phone kept", async () => {
    const again = await findOrCreateContact(primo, {
      name: "M. Lopez",
      email: "MARIA@primo.example",
      phone: "999",
    });
    expect(again.created).toBe(false);
    expect(again.contact).toMatchObject({ name: "Maria Lopez", phone: "403 555 0101" });
    expect(await contactsOf(primo)).toHaveLength(1);
  });

  test("the same email in another business is a different contact", async () => {
    const theirs = await findOrCreateContact(clinic, {
      name: "Maria",
      email: "maria@primo.example",
    });
    expect(theirs.created).toBe(true);
    const [mine] = await contactsOf(primo);
    expect(theirs.contact.id).not.toBe(mine.id);
  });

  test("when both businesses hold one email, each finds only its own contact", async () => {
    const [mine] = await contactsOf(primo);
    const [theirs] = await contactsOf(clinic);
    for (let round = 0; round < 3; round++) {
      expect(
        (await findOrCreateContact(primo, { name: "x", email: "maria@primo.example" })).contact.id
      ).toBe(mine.id);
      expect(
        (await findOrCreateContact(clinic, { name: "x", email: "maria@primo.example" })).contact.id
      ).toBe(theirs.id);
    }
  });

  test("two calls at the same instant with one email make one contact", async () => {
    const business = await makeBusiness("race");
    const both = await Promise.all([
      findOrCreateContact(business, { name: "Ana", email: "ana@race.example" }),
      findOrCreateContact(business, { name: "Ana", email: "ana@race.example" }),
    ]);
    expect(both.map((result) => result.created).sort()).toEqual([false, true]);
    expect(both[0].contact.id).toBe(both[1].contact.id);
    expect(await contactsOf(business)).toHaveLength(1);
  });

  test("no email always makes a new contact", async () => {
    const business = await makeBusiness("phone");
    const first = await findOrCreateContact(business, { name: "Walk-in", phone: "555" });
    const second = await findOrCreateContact(business, { name: "Walk-in", phone: "555" });
    expect([first.created, second.created]).toEqual([true, true]);
    expect(await contactsOf(business)).toHaveLength(2);
  });

  test("a database error never carries the customer's email out", async () => {
    // A business that does not exist: Postgres refuses the row, and its error names the query.
    const error = await findOrCreateContact(randomUUID(), {
      name: "Hidden",
      email: `hidden-${tag}@private.example`,
    }).catch((caught: Error) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/^Saving a contact failed: database error/);
    expect((error as Error).message).not.toContain(`hidden-${tag}`);
  });
});

describe("contact rules in the database", () => {
  test("an email not stored lowercase and trimmed is refused", async () => {
    const insert = (email: string) =>
      db.insert(contact).values({ id: randomUUID(), organizationId: primo, name: "X", email });
    await expect(insert("Upper@Primo.Example")).rejects.toMatchObject({
      cause: { code: "23514", constraint_name: "contact_email_normalized_check" },
    });
    await expect(insert(" spaced@primo.example")).rejects.toMatchObject({
      cause: { code: "23514", constraint_name: "contact_email_normalized_check" },
    });
  });

  test("one business cannot hold the same email twice", async () => {
    await expect(
      db.insert(contact).values({
        id: randomUUID(),
        organizationId: primo,
        name: "X",
        email: "maria@primo.example",
      })
    ).rejects.toMatchObject({
      cause: { code: "23505", constraint_name: "contact_organization_email_unique" },
    });
  });
});
