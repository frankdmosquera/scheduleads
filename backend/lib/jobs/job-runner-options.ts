// Backend: what every run of the runner shares: the database, a quiet logger, and the one line
// printed when a job gives up (decision 4). Used by the API's runner and by the tests' helper.

import { EventEmitter } from "node:events";

import { Logger, type RunnerOptions, type TaskList, type WorkerEvents } from "graphile-worker";

import { safeErrorReason } from "../errors/safe-error-reason.js";

// Warnings and errors only, first line only: a failure's stack adds nothing to a safe reason.
const logger = new Logger(() => (level, message) => {
  if (level !== "error" && level !== "warning") return;
  console.warn(`[jobs] ${message.split("\n")[0]}`);
});

// One line when a job has used its last attempt; it stays in the database, failed.
const events: WorkerEvents = new EventEmitter();
events.on("job:failed", ({ job, error }) => {
  const payload = job.payload as { bookingId?: unknown } | null;
  const booking = typeof payload?.bookingId === "string" ? ` for booking ${payload.bookingId}` : "";
  console.warn(
    `[jobs] gave up on ${job.task_identifier} job ${job.id}${booking} after ${job.attempts} attempts: ${safeErrorReason(error)}`
  );
});

export function jobRunnerOptions(taskList: TaskList): RunnerOptions {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is not set: the runner has no database.");
  return {
    connectionString: process.env.DATABASE_URL,
    taskList,
    logger,
    events,
    noHandleSignals: true, // server.ts stops the API and the runner together
  };
}
