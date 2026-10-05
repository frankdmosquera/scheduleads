// Backend: the job that writes a new booking's event into the booked person's calendar. A failure
// throws, so the runner tries again; the event's id makes a repeated write one event.

import { writeBookingEvent } from "../calendar/write-booking-event.js";
import { isBookingEventJobDue } from "./is-booking-event-job-due.js";
import { jobTask } from "./job-task.js";

// Ids only, never a customer's details.
export type BookingEventWriteJobPayloadType = {
  organizationId: string;
  bookingId: string;
  sequence: number;
};

export const bookingEventWriteJob = jobTask(async (payload) => {
  const { organizationId, bookingId, sequence } = payload as BookingEventWriteJobPayloadType;
  if (await isBookingEventJobDue(organizationId, bookingId, sequence)) {
    await writeBookingEvent(organizationId, bookingId);
  }
});
