// Backend: the name each kind of job is saved under, in one place, so the code that adds a job and
// the task that works it can never disagree.

export const jobNames = {
  bookingEmail: "booking_email",
  bookingEventWrite: "booking_event_write",
  bookingEventMove: "booking_event_move",
  bookingEventRemove: "booking_event_remove",
  bookingText: "booking_text",
  textReply: "text_reply",
} as const;
