// Backend: the id a booking's event carries in the booked person's calendar, made from the booking's
// own id, so writing it twice never makes two events and removing it needs nothing stored.

export function calendarEventIdOf(bookingId: string): string {
  // Google takes an id of lowercase letters a to v and digits, so a booking's id without dashes fits.
  const id = bookingId.replace(/-/g, "").toLowerCase();
  if (!/^[a-v0-9]{5,1024}$/.test(id)) throw new Error("A booking's event id does not fit Google.");
  return id;
}
