// Backend: which upcoming bookings a save of the Days off page leaves on a closed day (feature 12e).
// No database, so every rule is tested; lib/settings/ reads the rows and the bookings. Closing only
// stops new bookings: these are listed for the owner, never changed.

import { localDate } from "@scheduleads-app/shared/local-date";

import {
  applyBookableHoursRules,
  type BusinessHoursInputType,
  type PersonHoursInputType,
} from "./apply-bookable-hours-rules.js";
import { DAYS_OFF_AHEAD } from "./apply-opening-rules.js";
import type { CheckedBookingType } from "./apply-outside-hours-rules.js";

// The confirmed bookings still to come whose day is closed for their person after the save and was
// not before, in the order given. A day opened for the booked person is not closed for them, so
// their booking is not listed. Each person's closed days are the booking window's own answer.
export function applyNewlyClosedRules<Booking extends CheckedBookingType>(
  before: BusinessHoursInputType,
  after: BusinessHoursInputType,
  people: Map<string, PersonHoursInputType>, // each person's own row by id; no row: none of their own
  bookings: Booking[],
  now: Date // a parameter, not new Date() inside, so "still to come" can be tested
): Booking[] {
  const closedFor = (business: BusinessHoursInputType, personId: string) =>
    new Set(
      applyBookableHoursRules(
        { ...business, horizonDays: DAYS_OFF_AHEAD },
        people.get(personId) ?? null,
        now
      ).closedDates
    );
  const newlyClosed = new Map<string, { before: Set<string>; after: Set<string> }>(); // by person
  const isNewlyClosed = (booking: Booking) => {
    let days = newlyClosed.get(booking.personId);
    if (!days) {
      days = {
        before: closedFor(before, booking.personId),
        after: closedFor(after, booking.personId),
      };
      newlyClosed.set(booking.personId, days);
    }
    const date = localDate(booking.startsAt, after.timezone);
    return days.after.has(date) && !days.before.has(date);
  };

  return bookings.filter(
    (booking) =>
      booking.status === "confirmed" &&
      booking.startsAt.getTime() > now.getTime() &&
      isNewlyClosed(booking)
  );
}
