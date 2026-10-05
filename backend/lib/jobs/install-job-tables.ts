// Backend: installs or updates the runner's own tables (its schema `graphile_worker`, outside our
// Drizzle ledger). The API's runner does this itself when it starts; tests call it before adding
// their first job, since `db:migrate` builds a database without them.

import { runMigrations } from "graphile-worker";

import { jobRunnerOptions } from "./job-runner-options.js";
import { jobTasks } from "./job-tasks.js";

export async function installJobTables(): Promise<void> {
  await runMigrations(jobRunnerOptions(jobTasks));
}
