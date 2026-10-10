// Backend: which upcoming bookings a save of hours leaves outside them (feature 12a). No database,
// so every rule is tested; the saves in lib/settings/ read the rows and the bookings.

import { localDate } from "@scheduleads-app/shared/local-date";
import type { DateHoursType, WeeklyHoursType } from "@scheduleads-app/shared/zod-validation";

import { localTimeToMoment } from "../local-time/local-time-to-moment.js";

// The rows a save replaces, or the ones it writes: the business's week and one-off dates, its time
// zone, and each person's own row by id (no row: they follow the business's week).
export type HoursRowsType = {
  timezone: string;
  weeklyHours: WeeklyHoursType;
  dateHours: DateHoursType;
  people: Map<string, { weeklyHours: WeeklyHoursType | null; dateHours: DateHoursType }>;
};

export type CheckedBookingType = {
  personId: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
};

const WEEKDAYS: (keyof WeeklyHoursType)[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function weekdayOf(date: string): keyof WeeklyHoursType {
  const [year, month, day] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

// The person's windows on a date, by the same merge the booking window uses: an own week takes only
// their own one-off dates; someone following the business also gets the business's, their own
// winning on the same date; a one-off date replaces that day's week.
function windowsOn(date: string, personId: string, hours: HoursRowsType) {
  const person = hours.people.get(personId);
  const ownWeek = person?.weeklyHours ?? null;
  const oneOff =
    person?.dateHours.find((entry) => entry.date === date) ??
    (ownWeek ? undefined : hours.dateHours.find((entry) => entry.date === date));
  return oneOff?.windows ?? (ownWeek ?? hours.weeklyHours)[weekdayOf(date)] ?? [];
}

// A clock time as a real moment. A time in the hour skipped in spring is the moment the clocks
// jump, the first minute after it that exists.
function momentOf(date: string, minute: number, timezone: string): number {
  for (let later = minute; later <= minute + 120; later += 1) {
    const moment = localTimeToMoment(date, later, timezone);
    if (moment) return moment.getTime();
  }
  throw new Error(`No moment near minute ${minute} of ${date} in ${timezone}.`);
}

// Fits: the appointment itself (never its buffers) lies inside one window on its own local date,
// compared as real moments so a clock change cannot stretch or shrink a window.
function fitsHours(booking: CheckedBookingType, hours: HoursRowsType): boolean {
  const date = localDate(booking.startsAt, hours.timezone);
  const start = booking.startsAt.getTime();
  const end = booking.endsAt.getTime();
  return windowsOn(date, booking.personId, hours).some(
    (window) =>
      momentOf(date, window.startMinute, hours.timezone) <= start &&
      end <= momentOf(date, window.endMinute, hours.timezone)
  );
}

// The confirmed bookings still to come that fitted the hours before the save and do not fit after,
// in the order given. No hours before (a business's first save): nothing fitted, nothing is listed.
// Notice, how far ahead, closed days and holidays play no part: they only limit new bookings.
export function applyOutsideHoursRules<Booking extends CheckedBookingType>(
  before: HoursRowsType | null,
  after: HoursRowsType,
  bookings: Booking[],
  now: Date // a parameter, not new Date() inside, so "still to come" can be tested
): Booking[] {
  if (!before) return [];
  return bookings.filter(
    (booking) =>
      booking.status === "confirmed" &&
      booking.startsAt.getTime() > now.getTime() &&
      fitsHours(booking, before) &&
      !fitsHours(booking, after)
  );
}
