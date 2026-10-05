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
const MOST_RUNS = 20; // a run per job a lane holds back; far more than any test adds

export async function workDueJobs(taskList: TaskList = jobTasks): Promise<void> {
  const schema = sql.identifier(jobSchema);
  for (let run = 0; run < MOST_RUNS; run += 1) {
    await runOnce(jobRunnerOptions(taskList));
    // The library returns before it has written a job's end (done, or failed and unlocked), so wait
    // until no job is still locked: a test then reads what the run left.
    const deadline = Date.now() + MOST_WAIT_MS;
    for (;;) {
      const locked = await db.execute(
        sql`select 1 from ${schema}._private_jobs where locked_at is not null limit 1`
      );
      if (locked.length === 0) break;
      if (Date.now() >= deadline)
        throw new Error("A job was still locked 5 seconds after the run.");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    // A run can end while a job waits behind another in its lane whose end was not yet written:
    // run again until no job of this list is due.
    const due = await db.execute(
      sql`select 1 from ${schema}._private_jobs jobs
          join ${schema}._private_tasks tasks on tasks.id = jobs.task_id
          where jobs.is_available and jobs.run_at <= now()
          and tasks.identifier in (${sql.join(
            Object.keys(taskList).map((name) => sql`${name}`),
            sql`, `
          )})
          limit 1`
    );
    if (due.length === 0) return;
  }
  throw new Error(`Jobs were still due after ${MOST_RUNS} runs.`);
}
