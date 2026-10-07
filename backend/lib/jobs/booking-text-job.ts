// Backend: the job that sends one of a booking's texts (feature 8b). Ids only in its payload; the
// text reads the booking afresh when it runs (decision 6). A failure throws, so the runner tries
// again.

import { sendBookingText } from "../text/send-booking-text.js";
import { jobTask } from "./job-task.js";

// `sequence` is the booking's move number when the job was added; a reminder carries its minutes.
export type BookingTextJobPayloadType = {
  organizationId: string;
  bookingId: string;
  sequence: number;
} & ({ kind: "confirmation"; minutesBefore: null } | { kind: "reminder"; minutesBefore: number });

export const bookingTextJob = jobTask(async (payload, { attempt }) => {
  const job = payload as BookingTextJobPayloadType;
  if (job.kind === "reminder" && typeof job.minutesBefore === "number") {
    const text = { kind: job.kind, sequence: job.sequence, minutesBefore: job.minutesBefore };
    return sendBookingText(job.organizationId, job.bookingId, text, attempt);
  }
  if (job.kind === "confirmation") {
    return sendBookingText(job.organizationId, job.bookingId, { kind: job.kind }, attempt);
  }
  // Never guessed into another text: one that is neither is a fault to see, not a text to send.
  const { bookingId } = payload as { bookingId?: unknown };
  throw new Error(`A booking text job for booking ${String(bookingId)} is neither text.`);
});
