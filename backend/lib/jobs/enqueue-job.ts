// Backend: adds a job for the runner, inside the caller's transaction (decision 1): a change that
// rolls back leaves no job, one that commits always has its jobs. One SQL call into the runner's
// own schema, so it works on our Drizzle connection whatever driver the runner uses itself.

import { sql } from "drizzle-orm";

import type { DatabaseExecutorType } from "../../database-executor-type.js";
import { jobSchema } from "./job-schema.js";

// Up to 10 tries, the waits growing from seconds to about two hours (decision 4).
const MOST_ATTEMPTS = 10;

export type EnqueueJobOptionsType = {
  runAt?: Date; // not before then; now when left out
  queueName?: string; // one job at a time per queue; a failed one retries behind later ones
  maxAttempts?: number;
};

// The payload holds ids only: never a customer's details, a token or a key.
export async function enqueueJob(
  executor: DatabaseExecutorType,
  name: string,
  payload: Record<string, string | number | null>,
  { runAt, queueName, maxAttempts = MOST_ATTEMPTS }: EnqueueJobOptionsType = {}
): Promise<void> {
  await executor.execute(
    sql`select ${sql.identifier(jobSchema)}.add_job(
      ${name},
      ${JSON.stringify(payload)}::text::json, -- text first, so no driver encodes it twice
      queue_name => ${queueName ?? null}::text,
      run_at => ${runAt?.toISOString() ?? null}::timestamptz,
      max_attempts => ${maxAttempts}::int
    )`
  );
}
