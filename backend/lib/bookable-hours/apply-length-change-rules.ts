// Backend: which upcoming bookings of a service would no longer fit the hours at its new length
// (feature 12d, decision 9). A booking keeps the times it was booked for: this only finds the
// ones the owner should hear about. No database, so every rule is tested; the service save reads
// the rows and the bookings.

import {
  fitsHours,
  type CheckedBookingType,
  type HoursRowsType,
} from "./apply-outside-hours-rules.js";

const MINUTE_MS = 60_000;

export type LengthCheckedBookingType = CheckedBookingType & { serviceId: string };

// The service's confirmed bookings still to come that fit as booked and would not fit starting at
// the same moment with the new length, in the order given. The same fits test as a save of hours,
// so one-off dates, a person's own week and the clock change count the same way; buffers never.
export function applyLengthChangeRules<Booking extends LengthCheckedBookingType>(
  hours: HoursRowsType,
  serviceId: string,
  newLengthMinutes: number,
  bookings: Booking[],
  now: Date // a parameter, not new Date() inside, so "still to come" can be tested
): Booking[] {
  return bookings.filter(
    (booking) =>
      booking.serviceId === serviceId &&
      booking.status === "confirmed" &&
      booking.startsAt.getTime() > now.getTime() &&
      fitsHours(booking, hours) &&
      !fitsHours(
        {
          ...booking,
          endsAt: new Date(booking.startsAt.getTime() + newLengthMinutes * MINUTE_MS),
        },
        hours
      )
  );
}
