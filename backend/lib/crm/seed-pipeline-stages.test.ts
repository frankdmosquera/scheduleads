// The four default stages, against the local database. Every business here is a throwaway
// carrying this run's tag, removed after (its stages go with it).

import { randomUUID } from "node:crypto";

import { asc, eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the pipeline stage tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { organization, pipelineStage } = await import("@scheduleads-app/shared/db");
const { seedPipelineStages } = await import("./seed-pipeline-stages.js");

const tag = randomUUID().slice(0, 8);
const makeBusiness = async (name: string) => {
  const id = randomUUID();
  await db.insert(organization).values({ id, name, slug: `test-stages-${name}-${tag}` });
  return id;
};
const stagesOf = (organizationId: string) =>
  db
    .select({ name: pipelineStage.name, position: pipelineStage.position })
    .from(pipelineStage)
    .where(eq(pipelineStage.organizationId, organizationId))
    .orderBy(asc(pipelineStage.position));

let first = "";
let second = "";

beforeAll(async () => {
  first = await makeBusiness("first");
  second = await makeBusiness("second");
});

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-stages-%-${tag}`));
  await db.$client.end();
});

describe("seedPipelineStages", () => {
  test("gives a business with none New, Contacted, Booked and Done, in order", async () => {
    await seedPipelineStages(first);
    expect(await stagesOf(first)).toEqual([
      { name: "New", position: 1 },
      { name: "Contacted", position: 2 },
      { name: "Booked", position: 3 },
      { name: "Done", position: 4 },
    ]);
  });

  test("running it again adds nothing", async () => {
    await seedPipelineStages(first);
    await seedPipelineStages(first);
    expect(await stagesOf(first)).toHaveLength(4);
  });

  test("two calls at the same moment still give one of each", async () => {
    const both = await makeBusiness("both");
    await Promise.all([seedPipelineStages(both), seedPipelineStages(both)]);
    expect((await stagesOf(both)).map((stage) => stage.name)).toEqual([
      "New",
      "Contacted",
      "Booked",
      "Done",
    ]);
  });

  test("a business that already has a stage keeps its own", async () => {
    const own = await makeBusiness("own");
    await db
      .insert(pipelineStage)
      .values({ id: randomUUID(), organizationId: own, name: "Enquiry", position: 1 });
    await seedPipelineStages(own);
    expect(await stagesOf(own)).toEqual([{ name: "Enquiry", position: 1 }]);
  });
});

describe("pipeline_stage names", () => {
  test("two businesses can each have a New", async () => {
    await seedPipelineStages(second);
    expect((await stagesOf(second))[0]).toEqual({ name: "New", position: 1 });
  });

  test("one business cannot have two stages of the same name, capitals ignored", async () => {
    const add = (name: string) =>
      db
        .insert(pipelineStage)
        .values({ id: randomUUID(), organizationId: first, name, position: 9 });
    await expect(add("New")).rejects.toThrow();
    await expect(add("new")).rejects.toThrow();
    await expect(add("NEW")).rejects.toThrow();
  });
});
