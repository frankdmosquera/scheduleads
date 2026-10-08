// Backend: whether a "new booking" or "moved" text to this person for this booking was tried and
// still waits for another try, so it may have reached them (feature 8c, decision 5): a send whose
// answer was lost throws to be retried, and its retry waits behind later jobs of the lane. Read
// from the runner's own table: the waiting job is the only record of that try.

import { sql } from "drizzle-orm";

import { db } from "../../database.js";
import { jobNames } from "./job-names.js";
import { jobSchema } from "./job-schema.js";

export async function hasWorkerTextInDoubt(bookingId: string, personId: string): Promise<boolean> {
  const schema = sql.identifier(jobSchema);
  const rows = await db.execute(
    sql`select 1 from ${schema}._private_jobs jobs
        join ${schema}._private_tasks tasks on tasks.id = jobs.task_id
        where tasks.identifier = ${jobNames.workerText}
        and jobs.payload->>'bookingId' = ${bookingId}
        and jobs.payload->>'personId' = ${personId}
        and jobs.payload->>'kind' in ('added', 'moved')
        and jobs.attempts > 0
        limit 1`
  );
  return rows.length > 0;
}
