// Backend: the job that takes a booking's event out of one person's calendar, both named when the
// job was added (decision 6), so it never depends on where the booking is now. It runs even after
// the appointment has started: the event it removes can be at another time. A failure throws, so
// the runner tries again.

import { removeBookingEvent } from "../calendar/remove-booking-event.js";
import { jobTask } from "./job-task.js";

// Ids only.
export type BookingEventRemovalJobPayloadType = {
  organizationId: string;
  bookingId: string;
  personId: string;
  eventId: string;
};

export const bookingEventRemovalJob = jobTask(async (payload) => {
  const { organizationId, bookingId, personId, eventId } =
    payload as BookingEventRemovalJobPayloadType;
  await removeBookingEvent(organizationId, bookingId, personId, eventId);
});
