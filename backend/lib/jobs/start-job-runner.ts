// Backend: starts the runner inside the API process (decision 7). It installs or updates its own
// tables first, then takes every job due, now and as each comes due; jobs added meanwhile wake it
// at once. Stopping it lets the jobs in hand finish (`runner.stop()`).

import { run, type Runner, type TaskList } from "graphile-worker";

import { safeErrorReason } from "../errors/safe-error-reason.js";
import { jobRunnerOptions } from "./job-runner-options.js";
import { jobTasks } from "./job-tasks.js";
import { retryWhileDatabaseRefuses } from "./retry-while-database-refuses.js";

const CONCURRENT_JOBS = 5; // emails and Google calls mostly wait on the network

// A restart can beat Postgres back up (F-179): wait for it this long, then exit as before.
const DATABASE_WAIT_LIMIT_MS = 60_000;
const DATABASE_WAIT_STEP_MS = 2_000;

// Null when no job is defined: with an empty list its workers would poll every two seconds for
// nothing, silently, since the logger drops their debug lines.
export async function startJobRunner(taskList: TaskList = jobTasks): Promise<Runner | null> {
  if (Object.keys(taskList).length === 0) return null;
  return retryWhileDatabaseRefuses(
    () => run({ ...jobRunnerOptions(taskList), concurrency: CONCURRENT_JOBS }),
    {
      limitMs: DATABASE_WAIT_LIMIT_MS,
      waitMs: DATABASE_WAIT_STEP_MS,
      onWait: (error) =>
        console.warn(`[jobs] database not up yet, trying again: ${safeErrorReason(error)}`),
    }
  );
}
