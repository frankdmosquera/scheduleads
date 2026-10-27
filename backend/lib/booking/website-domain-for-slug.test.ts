// A business's Website by its address, kept for a minute (feature 25b), against the local
// database: a throwaway business carrying this run's tag, removed after.

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the code reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the website lookup tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { organization } = await import("@scheduleads-app/shared/db");
const { websiteDomainForSlug } = await import("./website-domain-for-slug.js");

const tag = randomUUID().slice(0, 8);
const id = randomUUID();
const slug = `test-website-${tag}-dev`;

afterAll(async () => {
  await db.delete(organization).where(eq(organization.id, id));
  await db.$client.end();
});

describe("a business's Website by its address", () => {
  test("is kept for a minute, then read again", async () => {
    await db
      .insert(organization)
      .values({ id, name: "Glow Spa", slug, website: "https://www.glowspa.test/book" });
    const now = Date.now();

    expect(await websiteDomainForSlug(slug, now)).toBe("glowspa.test");
    await db
      .update(organization)
      .set({ website: "https://glow-new.test" })
      .where(eq(organization.id, id));
    expect(await websiteDomainForSlug(slug, now + 59_000)).toBe("glowspa.test"); // still kept
    expect(await websiteDomainForSlug(slug, now + 61_000)).toBe("glow-new.test"); // read again
  });

  test("an unknown business, or an address of the wrong shape, has none", async () => {
    expect(await websiteDomainForSlug(`test-nobody-${tag}-dev`)).toBeNull();
    expect(await websiteDomainForSlug("Not A Slug")).toBeNull();
  });
});
