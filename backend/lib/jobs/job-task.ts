// Backend: wraps a job's work so a failure the runner stores and prints is always a safe reason:
// a database error's message carries the whole query, so only its code survives.

import type { Task } from "graphile-worker";

import { safeErrorReason } from "../errors/safe-error-reason.js";

export function jobTask(work: (payload: unknown) => Promise<void>): Task {
  return async (payload) => {
    try {
      await work(payload);
    } catch (error) {
      throw new Error(safeErrorReason(error)); // thrown, so the runner tries again
    }
  };
}
