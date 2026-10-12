// Backend: adds many jobs of one kind for the runner in one SQL call, inside the caller's
// transaction (decision 1), so a save that owes hundreds of them makes one round trip, not hundreds.

import { sql } from "drizzle-orm";

import type { DatabaseExecutorType } from "../../database-executor-type.js";
import { jobSchema } from "./job-schema.js";

// Up to 10 tries, the waits growing from seconds to about two hours (decision 4).
const MOST_ATTEMPTS = 10;

export async function enqueueJobs(
  executor: DatabaseExecutorType,
  name: string,
  // The payload holds ids only: never a customer's details, a token or a key.
  jobs: { payload: Record<string, string | number | null>; runAt: Date; jobKey: string }[]
): Promise<void> {
  if (jobs.length === 0) return;
  const rows = jobs.map(({ payload, runAt, jobKey }) => ({
    payload,
    run_at: runAt.toISOString(),
    job_key: jobKey,
  }));
  await executor.execute(
    sql`select ${sql.identifier(jobSchema)}.add_job(
      ${name},
      job.payload,
      run_at => job.run_at,
      max_attempts => ${MOST_ATTEMPTS}::int,
      job_key => job.job_key
    )
    from json_to_recordset(${JSON.stringify(rows)}::text::json)
      as job(payload json, run_at timestamptz, job_key text)`
  );
}
