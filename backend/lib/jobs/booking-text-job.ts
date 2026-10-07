// Backend: the job that sends one of a booking's texts (feature 8b). Ids only in its payload; the
// text reads the booking afresh when it runs (decision 6). A failure throws, so the runner tries
// again.

import { sendBookingText } from "../text/send-booking-text.js";
import { jobTask } from "./job-task.js";

// `sequence` is the booking's move number when the job was added; `minutesBefore` is a
// reminder's, null for the confirmation.
export type BookingTextJobPayloadType = {
  organizationId: string;
  bookingId: string;
  kind: "confirmation" | "reminder";
  sequence: number;
  minutesBefore: number | null;
};

export const bookingTextJob = jobTask(async (payload, { attempt }) => {
  const { organizationId, bookingId, kind, sequence, minutesBefore } =
    payload as BookingTextJobPayloadType;
  const text =
    kind === "reminder" && minutesBefore !== null
      ? ({ kind, sequence, minutesBefore } as const)
      : ({ kind: "confirmation" } as const);
  await sendBookingText(organizationId, bookingId, text, attempt);
});
