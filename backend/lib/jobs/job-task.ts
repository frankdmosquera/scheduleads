// Backend: wraps a job's work so a failure the runner stores and prints is always a safe reason:
// a database error's message carries the whole query, so only its code survives. The work is told
// which try this is, 1 the first time, so a job can check before it repeats something.

import type { Task } from "graphile-worker";

import { safeErrorReason } from "../errors/safe-error-reason.js";

export type JobTryType = { attempt: number };

export function jobTask(work: (payload: unknown, job: JobTryType) => Promise<void>): Task {
  return async (payload, helpers) => {
    try {
      await work(payload, { attempt: helpers.job.attempts });
    } catch (error) {
      throw new Error(safeErrorReason(error)); // thrown, so the runner tries again
    }
  };
}
