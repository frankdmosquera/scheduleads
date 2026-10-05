// Backend: the job that makes a moved booking's event follow it: the saved event updated in place,
// or a new one written when none is saved, as after a change of person. A failure throws, so the
// runner tries again.

import { moveBookingEvent } from "../calendar/move-booking-event.js";
import { isBookingEventJobDue } from "./is-booking-event-job-due.js";
import { jobTask } from "./job-task.js";

// Ids only. `sequence` is the move's number.
export type BookingEventMoveJobPayloadType = {
  organizationId: string;
  bookingId: string;
  sequence: number;
};

export const bookingEventMoveJob = jobTask(async (payload) => {
  const { organizationId, bookingId, sequence } = payload as BookingEventMoveJobPayloadType;
  if (await isBookingEventJobDue(organizationId, bookingId, sequence)) {
    await moveBookingEvent(organizationId, bookingId);
  }
});
