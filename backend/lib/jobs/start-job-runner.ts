// Backend: starts the runner inside the API process (decision 7). It installs or updates its own
// tables first, then takes every job due, now and as each comes due; jobs added meanwhile wake it
// at once. Stopping it lets the jobs in hand finish (`runner.stop()`).

import { run, type Runner, type TaskList } from "graphile-worker";

import { jobRunnerOptions } from "./job-runner-options.js";
import { jobTasks } from "./job-tasks.js";

const CONCURRENT_JOBS = 5; // emails and Google calls mostly wait on the network

// Null when no job is defined: the library's workers refuse an empty list and exit at once.
export async function startJobRunner(taskList: TaskList = jobTasks): Promise<Runner | null> {
  if (Object.keys(taskList).length === 0) return null;
  return run({ ...jobRunnerOptions(taskList), concurrency: CONCURRENT_JOBS });
}
