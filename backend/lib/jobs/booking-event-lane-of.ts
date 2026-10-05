// Backend: the lane a booking's calendar jobs run in (decision 5). One of 256, named by the last
// two characters of the booking's id: two of its jobs never run at once, the lanes stay few, and a
// lane held by a crash holds back few other bookings.

export function bookingEventLaneOf(bookingId: string): string {
  return `booking-event-${bookingId.slice(-2).toLowerCase()}`;
}
