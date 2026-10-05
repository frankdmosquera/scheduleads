// Backend: the job that takes a booking's event out of one person's calendar, both named when the
// job was added (decision 6), so it never depends on where the booking is now. With no id saved
// yet, the event may sit under the id of any earlier write, so each of them goes; one that was
// never written is gone already, as Google answers. It runs even after the appointment has
// started: the event it removes can be at another time. A failure throws, so the runner tries
// again.

import { calendarEventIdOf } from "../calendar/calendar-event-id-of.js";
import { removeBookingEvent } from "../calendar/remove-booking-event.js";
import { jobTask } from "./job-task.js";

// Ids only. eventId: the saved one, or null when none was saved; sequence: the booking's move
// number when the job was added, so the ids it may have had are known.
export type BookingEventRemovalJobPayloadType = {
  organizationId: string;
  bookingId: string;
  personId: string;
  eventId: string | null;
  sequence: number;
};

export const bookingEventRemovalJob = jobTask(async (payload) => {
  const { organizationId, bookingId, personId, eventId, sequence } =
    payload as BookingEventRemovalJobPayloadType;
  const eventIds = eventId
    ? [eventId]
    : Array.from({ length: sequence + 1 }, (_, each) => calendarEventIdOf(bookingId, each));
  await removeBookingEvent(organizationId, bookingId, personId, eventIds);
});
