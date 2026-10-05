// Backend: works every job due right now to the end, one at a time, then returns: how tests run
// the jobs a booking added without starting the runner (decision 8). A job that fails waits for
// its next try like any other; a test that wants that try makes it due again.

import { sql } from "drizzle-orm";
import { runOnce, type TaskList } from "graphile-worker";

import { db } from "../../database.js";
import { jobRunnerOptions } from "./job-runner-options.js";
import { jobSchema } from "./job-schema.js";
import { jobTasks } from "./job-tasks.js";

const MOST_WAIT_MS = 5_000;

export async function workDueJobs(taskList: TaskList = jobTasks): Promise<void> {
  await runOnce(jobRunnerOptions(taskList));
  // The library returns before it has written a job's end (done, or failed and unlocked), so wait
  // until no job is still locked: a test then reads what the run left (F-184).
  const deadline = Date.now() + MOST_WAIT_MS;
  while (Date.now() < deadline) {
    const locked = await db.execute(
      sql`select 1 from ${sql.identifier(jobSchema)}._private_jobs where locked_at is not null limit 1`
    );
    if (locked.length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("A job was still locked 5 seconds after the run ended.");
}
