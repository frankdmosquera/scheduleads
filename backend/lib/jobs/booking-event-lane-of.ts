// Backend: the lane a booking's calendar jobs run in (decision 5). One of 16, named by the last
// character of the booking's id: two of its jobs never run at once, and the lanes stay few.

export function bookingEventLaneOf(bookingId: string): string {
  return `booking-event-${bookingId.slice(-1).toLowerCase()}`;
}
