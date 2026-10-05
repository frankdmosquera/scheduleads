// Backend: works every job due right now to the end, one at a time, then returns: how tests run
// the jobs a booking added without starting the runner (decision 8). A job that fails waits for
// its next try like any other; a test that wants that try makes it due again.

import { runOnce, type TaskList } from "graphile-worker";

import { jobRunnerOptions } from "./job-runner-options.js";
import { jobTasks } from "./job-tasks.js";

export async function workDueJobs(taskList: TaskList = jobTasks): Promise<void> {
  await runOnce(jobRunnerOptions(taskList));
}
