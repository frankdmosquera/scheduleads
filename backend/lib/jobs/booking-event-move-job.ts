// Backend: the job that makes a moved booking's event follow it: the same event updated in place
// when the person stayed, a new one written when the person changed. A failure throws, so the
// runner tries again.

import { moveBookingEvent } from "../calendar/move-booking-event.js";
import { isBookingEventJobDue } from "./is-booking-event-job-due.js";
import { jobTask } from "./job-task.js";

// Ids only. eventId: the event to update when the move kept the person and no id was saved yet,
// null otherwise.
export type BookingEventMoveJobPayloadType = {
  organizationId: string;
  bookingId: string;
  sequence: number;
  eventId: string | null;
};

export const bookingEventMoveJob = jobTask(async (payload) => {
  const { organizationId, bookingId, sequence, eventId } =
    payload as BookingEventMoveJobPayloadType;
  if (await isBookingEventJobDue(organizationId, bookingId, sequence)) {
    await moveBookingEvent(organizationId, bookingId, eventId);
  }
});
