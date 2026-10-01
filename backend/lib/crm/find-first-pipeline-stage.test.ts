// A business's first stage, against the local database. Throwaway businesses, removed after.

import { randomUUID } from "node:crypto";

import { like } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the first stage tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { organization, pipelineStage } = await import("@scheduleads-app/shared/db");
const { findFirstPipelineStage } = await import("./find-first-pipeline-stage.js");
const { seedPipelineStages } = await import("./seed-pipeline-stages.js");

const tag = randomUUID().slice(0, 8);
const makeBusiness = async (name: string) => {
  const id = randomUUID();
  await db.insert(organization).values({ id, name, slug: `test-first-${name}-${tag}` });
  return id;
};

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-first-%-${tag}`));
  await db.$client.end();
});

describe("findFirstPipelineStage", () => {
  test("is New for a business with the four defaults", async () => {
    const business = await makeBusiness("defaults");
    await seedPipelineStages(business);
    expect(await findFirstPipelineStage(business)).toMatchObject({ name: "New", position: 1 });
  });

  test("is the lowest position, whatever order the rows were made in", async () => {
    const business = await makeBusiness("reordered");
    await db.insert(pipelineStage).values([
      { id: randomUUID(), organizationId: business, name: "Later", position: 5 },
      { id: randomUUID(), organizationId: business, name: "Earliest", position: 2 },
    ]);
    expect(await findFirstPipelineStage(business)).toMatchObject({ name: "Earliest" });
  });

  test("is nothing for a business with no stages", async () => {
    expect(await findFirstPipelineStage(await makeBusiness("none"))).toBeNull();
  });

  test("never answers with another business's stage", async () => {
    const mine = await makeBusiness("mine");
    const theirs = await makeBusiness("theirs");
    await seedPipelineStages(theirs);
    expect(await findFirstPipelineStage(mine)).toBeNull();
  });
});
