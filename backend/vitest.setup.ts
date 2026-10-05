// Backend tests, before each file. Each Vitest worker keeps its jobs in a schema of its own, so a
// test that works the due jobs never takes another file's, nor one the dev API added; the files
// still run side by side. Any job an earlier file left in it is cleared. The jobs' clock is pinned
// to the Friday before the fixed Monday, October 5 2026, that the tests book on, so "has the
// appointment started" never depends on the day the tests run.

import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { runMigrations } from "graphile-worker";
import postgres from "postgres";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

import { jobClock } from "./lib/jobs/job-clock.js";

const schema = `graphile_worker_test_${process.env.VITEST_POOL_ID ?? "1"}`;
process.env.JOBS_SCHEMA = schema; // read by lib/jobs/job-schema.ts when a test imports it

jobClock.now = () => new Date("2026-10-02T14:00:00Z");

// Only the database's address, read without loading the .env: some tests check how the API
// behaves when a setting is missing.
function databaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    return parseEnv(readFileSync(new URL("../.env", import.meta.url), "utf8")).DATABASE_URL;
  } catch {
    return undefined;
  }
}

const url = databaseUrl();
assertLocalDevDatabase(url, "run the backend tests");
await runMigrations({ connectionString: url, schema, logger: undefined });
const client = postgres(url!, { max: 1, onnotice: () => {} });
await client.unsafe(`delete from "${schema}"._private_jobs`);
await client.end();
