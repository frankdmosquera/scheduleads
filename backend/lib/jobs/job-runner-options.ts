// Backend: what every run of the runner shares: the database, a quiet logger, and the one line
// printed when a job gives up (decision 4). Used by the API's runner and by the tests' helper.

import { EventEmitter } from "node:events";

import { Logger, type RunnerOptions, type TaskList, type WorkerEvents } from "graphile-worker";

import { safeErrorReason } from "../errors/safe-error-reason.js";
import { jobSchema } from "./job-schema.js";

// The booking a job is for, when its payload names one: ids only.
function bookingOf(payload: unknown): string {
  const bookingId = (payload as { bookingId?: unknown } | null)?.bookingId;
  return typeof bookingId === "string" ? ` for booking ${bookingId}` : "";
}

// Warnings and errors only, first line only: a failure's stack adds nothing to a safe reason. A
// failed try names its booking, as the line when a job gives up does.
const logger = new Logger(() => (level, message, meta) => {
  if (level !== "error" && level !== "warning") return;
  const job = (meta as { job?: { payload?: unknown } } | undefined)?.job;
  console.warn(`[jobs] ${message.split("\n")[0]}${job ? bookingOf(job.payload) : ""}`);
});

// One line when a job has used its last attempt; it stays in the database, failed.
const events: WorkerEvents = new EventEmitter();
events.on("job:failed", ({ job, error }) => {
  console.warn(
    `[jobs] gave up on ${job.task_identifier} job ${job.id}${bookingOf(job.payload)} after ${job.attempts} attempts: ${safeErrorReason(error)}`
  );
});

export function jobRunnerOptions(taskList: TaskList): RunnerOptions {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is not set: the runner has no database.");
  return {
    connectionString: process.env.DATABASE_URL,
    schema: jobSchema,
    taskList,
    logger,
    events,
    noHandleSignals: true, // server.ts stops the API and the runner together
    // Jobs are named in code, never loaded from files: the plugin that would look for executable
    // task files only warns, on Windows, that it cannot.
    preset: { disablePlugins: ["LoadTaskFromExecutableFilePlugin"] },
  };
}
