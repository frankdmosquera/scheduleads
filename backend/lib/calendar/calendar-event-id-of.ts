// Backend: the id a booking's event carries in the booked person's calendar, made from the booking's
// own id, so writing it twice never makes two events. A write after a move (feature 7b) adds the
// move's number: Google refuses an id it once deleted in a calendar, so moving back to a person
// whose calendar held the event must not reuse it. The first write (sequence 0) keeps the plain id,
// so a cancel can still find an event whose id was not saved yet.

export function calendarEventIdOf(bookingId: string, sequence = 0): string {
  // Google takes an id of lowercase letters a to v and digits, so a booking's id without dashes fits.
  const base = bookingId.replace(/-/g, "").toLowerCase();
  const id = sequence === 0 ? base : `${base}s${sequence}`;
  if (!/^[a-v0-9]{5,1024}$/.test(id)) throw new Error("A booking's event id does not fit Google.");
  return id;
}
