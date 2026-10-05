// Backend tests, before each file. Each Vitest worker keeps its jobs in a schema of its own, so a
// test that works the due jobs never takes another file's, nor one the dev API added; the files
// still run side by side. Every test starts with no job waiting (F-180): a job a test left failing
// on purpose would otherwise be retried inside the next test. No test reaches a server outside
// this machine, whatever a file stubs or unstubs. The jobs' clock is pinned to the Friday before
// the fixed Monday, October 5 2026, that the tests book on, so "has the appointment started"
// never depends on the day the tests run.

import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { runMigrations } from "graphile-worker";
import postgres from "postgres";
import { afterAll, afterEach } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

import { jobClock } from "./lib/jobs/job-clock.js";

const schema = `graphile_worker_test_${process.env.VITEST_POOL_ID ?? "1"}`;
process.env.JOBS_SCHEMA = schema; // read by lib/jobs/job-schema.ts when a test imports it

jobClock.now = () => new Date("2026-10-02T14:00:00Z");

// The real fetch, kept to this machine: a file that unstubs its fake and then works a job can no
// longer send a real email or call Google.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error(`A test tried to reach ${url.origin}; tests never leave this machine.`);
  }
  return realFetch(input, init);
}) as typeof fetch;

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
await runMigrations({
  connectionString: url,
  schema,
  preset: { disablePlugins: ["LoadTaskFromExecutableFilePlugin"] }, // as the API's runner
});
const client = postgres(url!, { max: 1, onnotice: () => {} });
const clearJobs = () => client.unsafe(`delete from "${schema}"._private_jobs`);
await clearJobs();

afterEach(async () => {
  await clearJobs();
});

afterAll(async () => {
  await client.end();
});
