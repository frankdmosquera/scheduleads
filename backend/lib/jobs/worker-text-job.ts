// Backend: the job that sends one of a booked worker's texts (feature 8c). Ids and times only in
// its payload; the text reads the booking afresh when it runs (decision 5). A failure throws, so
// the runner tries again.

import { sendWorkerText } from "../text/send-worker-text.js";
import { jobTask } from "./job-task.js";

// `sequence` is the booking's move number when the job was added; `changedAt` when the change was
// saved, as an ISO time.
export type WorkerTextJobPayloadType = {
  organizationId: string;
  bookingId: string;
  personId: string;
  sequence: number;
  changedAt: string;
} & { kind: "added"; startsAt: null };

export const workerTextJob = jobTask(async (payload, { attempt }) => {
  const job = payload as WorkerTextJobPayloadType;
  if (job.kind === "added") {
    const text = { kind: job.kind, personId: job.personId, changedAt: new Date(job.changedAt) };
    return sendWorkerText(job.organizationId, job.bookingId, text, attempt);
  }
  // Never guessed into another text: one of no known kind is a fault to see, not a text to send.
  const { bookingId } = payload as { bookingId?: unknown };
  throw new Error(`A worker text job for booking ${String(bookingId)} is of no known kind.`);
});
