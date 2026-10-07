// Backend: the job that sends one of a booking's texts (feature 8b). Ids only in its payload; the
// text reads the booking afresh when it runs (decision 6). A failure throws, so the runner tries
// again.

import { sendConfirmationText } from "../text/send-confirmation-text.js";
import { jobTask } from "./job-task.js";

// `sequence` is the booking's move number when the job was added; `minutesBefore` is a
// reminder's (feature 8b, step 8b.3), null for the confirmation.
export type BookingTextJobPayloadType = {
  organizationId: string;
  bookingId: string;
  kind: "confirmation";
  sequence: number;
  minutesBefore: number | null;
};

export const bookingTextJob = jobTask(async (payload, { attempt }) => {
  const { organizationId, bookingId } = payload as BookingTextJobPayloadType;
  await sendConfirmationText(organizationId, bookingId, attempt);
});
