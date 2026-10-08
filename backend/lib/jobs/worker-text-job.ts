// Backend: the job that sends one of a booked worker's texts (feature 8c). Ids and times only in
// its payload; the text reads the booking afresh when it runs (decision 5). A failure throws, so
// the runner tries again.

import { sendWorkerText } from "../text/send-worker-text.js";
import { jobTask } from "./job-task.js";

// `sequence` is the booking's move number when the job was added; `changedAt` when the change was
// saved, and a "removed" text's `startsAt` the time the person had, both as ISO times.
export type WorkerTextJobPayloadType = {
  organizationId: string;
  bookingId: string;
  personId: string;
  sequence: number;
  changedAt: string;
} & ({ kind: "added" | "moved"; startsAt: null } | { kind: "removed"; startsAt: string });

export const workerTextJob = jobTask(async (payload, { attempt }) => {
  const job = payload as WorkerTextJobPayloadType;
  const change = {
    personId: job.personId,
    sequence: job.sequence,
    changedAt: new Date(job.changedAt),
  };
  if (job.kind === "added" || job.kind === "moved") {
    const text = { ...change, kind: job.kind };
    return sendWorkerText(job.organizationId, job.bookingId, text, attempt);
  }
  if (job.kind === "removed" && typeof job.startsAt === "string") {
    const text = { ...change, kind: job.kind, startsAt: new Date(job.startsAt) };
    return sendWorkerText(job.organizationId, job.bookingId, text, attempt);
  }
  // Never guessed into another text: one of no known kind is a fault to see, not a text to send.
  const { bookingId } = payload as { bookingId?: unknown };
  throw new Error(`A worker text job for booking ${String(bookingId)} is of no known kind.`);
});
