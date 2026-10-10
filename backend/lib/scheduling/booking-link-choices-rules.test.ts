// A service's two choices for its booking modal (feature 9, decisions 3 and 4), proved by inserting
// services directly into the local database. Every business here is a throwaway carrying this
// run's tag, removed after (its services go with it).

import { randomUUID } from "node:crypto";

import { like, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the service choice tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { organization } = await import("@scheduleads-app/shared/db");

const tag = randomUUID().slice(0, 8);
const business = randomUUID();

const refusedBy = (code: string, constraint?: string) => ({
  cause: constraint ? { code, constraint_name: constraint } : { code },
});

// Raw SQL, so a value the TypeScript types would stop still reaches the database's own rule.
const insertService = (columns: { layout?: string; personChoice?: string }) => {
  const id = randomUUID();
  const slug = `facial-${randomUUID().slice(0, 8)}`;
  if (columns.layout === undefined) {
    return db.execute(sql`insert into booking_link
      (id, "organizationId", name, slug, "durationMinutes", "personChoice", "asksAddress")
      values (${id}, ${business}, 'Facial', ${slug}, 60, ${columns.personChoice ?? null}, true)`);
  }
  if (columns.personChoice === undefined) {
    return db.execute(sql`insert into booking_link
      (id, "organizationId", name, slug, "durationMinutes", layout, "asksAddress")
      values (${id}, ${business}, 'Facial', ${slug}, 60, ${columns.layout}, true)`);
  }
  return db.execute(sql`insert into booking_link
    (id, "organizationId", name, slug, "durationMinutes", layout, "personChoice", "asksAddress")
    values (${id}, ${business}, 'Facial', ${slug}, 60, ${columns.layout}, ${columns.personChoice}, true)`);
};

beforeAll(async () => {
  await db
    .insert(organization)
    .values({ id: business, name: "Choices", slug: `test-choices-${tag}` });
});

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-choices-${tag}`));
  await db.$client.end();
});

describe("a service's layout and who picks the person, in the database", () => {
  test.each(["customer_picks", "business_assigns"])(
    "the month with %s is stored",
    async (personChoice) => {
      await expect(insertService({ layout: "month", personChoice })).resolves.toBeDefined();
    }
  );

  test("a layout not built yet is refused", async () => {
    await expect(
      insertService({ layout: "week", personChoice: "business_assigns" })
    ).rejects.toMatchObject(refusedBy("23514", "booking_link_layout_check"));
  });

  test("an unknown pick is refused", async () => {
    await expect(insertService({ layout: "month", personChoice: "anyone" })).rejects.toMatchObject(
      refusedBy("23514", "booking_link_person_choice_check")
    );
  });

  // No default for either (decision 30): a service that does not say is refused.
  test("a service with no layout is refused", async () => {
    await expect(insertService({ personChoice: "business_assigns" })).rejects.toMatchObject(
      refusedBy("23502")
    );
  });

  test("a service that does not say who picks is refused", async () => {
    await expect(insertService({ layout: "month" })).rejects.toMatchObject(refusedBy("23502"));
  });
});
