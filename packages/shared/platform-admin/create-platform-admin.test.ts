// Runs against the local scheduleads_dev inside one transaction that is always rolled back, so the
// seed's admin is only set aside for the test and nothing is left behind.

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import * as schema from "../db/index.js";
import { user } from "../db/index.js";
import { assertLocalDevDatabase } from "../helpers/assert-local-dev-database.js";
import { createPlatformAdmin } from "./create-platform-admin.js";

if (!process.env.DATABASE_URL) process.loadEnvFile("../../.env");
assertLocalDevDatabase(process.env.DATABASE_URL, "platform admin tests");
const client = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const db = drizzle(client, { schema });
afterAll(() => client.end());

class Undo extends Error {}
type TransactionType = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Runs the test inside a transaction, then undoes everything it wrote.
async function rolledBack(test: (tx: TransactionType) => Promise<void>) {
  await expect(
    db.transaction(async (tx) => {
      await test(tx);
      throw new Undo();
    })
  ).rejects.toThrow(Undo);
}

// The same, on a database with no admin, as a fresh live one is.
async function onDatabaseWithNoAdmin(test: (tx: TransactionType) => Promise<void>) {
  await rolledBack(async (tx) => {
    await tx.update(user).set({ role: null }).where(eq(user.role, "admin"));
    await test(tx);
  });
}

describe("admin:create", () => {
  it("makes one admin, then refuses a second", async () => {
    await onDatabaseWithNoAdmin(async (tx) => {
      expect(await createPlatformAdmin(tx, " Frank@Example.com ")).toEqual({
        ok: true,
        email: "frank@example.com",
      });
      const [made] = await tx.select().from(user).where(eq(user.email, "frank@example.com"));
      expect(made).toMatchObject({ role: "admin", emailVerified: true, name: "" });

      expect(await createPlatformAdmin(tx, "someone-else@example.com")).toEqual({
        ok: false,
        reason: "There is already a platform admin: frank@example.com.",
      });
    });
  });

  it("refuses on the seeded database, which has its admin", async () => {
    // Rolled back too: on a dev database that was never seeded it would make a real admin.
    await rolledBack(async (tx) => {
      const result = await createPlatformAdmin(tx, "another-admin@example.com");
      expect(result.ok).toBe(false);
    });
  });

  it("refuses what is not an email, and an email that is already a login", async () => {
    await onDatabaseWithNoAdmin(async (tx) => {
      expect(await createPlatformAdmin(tx, "frank")).toEqual({
        ok: false,
        reason: '"frank" is not an email address.',
      });
      expect(await createPlatformAdmin(tx, "owner@example.com")).toEqual({
        ok: false,
        reason: "owner@example.com is already a login, not an admin one.",
      });
    });
  });
});
