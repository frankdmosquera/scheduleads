// Backend: the Days off page's rules (feature 12e): which days are closed, who each one is opened
// for, and what "open again" writes. No database, so every rule is tested; lib/settings/ reads and
// writes the rows. A one-off date is what opens a closed day, as the booking window reads it.

import { addDays } from "@scheduleads-app/shared/add-days";
import { localDate } from "@scheduleads-app/shared/local-date";
import type { DateHoursType } from "@scheduleads-app/shared/zod-validation";

import {
  applyBookableHoursRules,
  type BusinessHoursInputType,
  type PersonHoursInputType,
} from "./apply-bookable-hours-rules.js";
import { closedDaysBetween } from "./closed-days-between.js";
import { weekdayOf } from "./weekday-of.js";

// The page looks a year ahead, the longest a business can take bookings, so a day closed beyond
// today's booking window still shows.
export const DAYS_OFF_AHEAD = 365;

export type ClosedDayType = {
  date: string; // YYYY-MM-DD, the business's clock
  name: string | null; // the holiday's, or null for a date the business closed
  openedForEveryone: boolean; // the business has a one-off date on it
  openedFor: string[]; // the people with a one-off date of their own on it
};

export type OpeningType =
  | { ok: true; whose: "business"; closedDates: string[]; dateHours: DateHoursType }
  | { ok: true; whose: "person"; dateHours: DateHoursType }
  | { ok: false; reason: "not_closed" | "no_usual_hours" };

// Every closed day from today to a year ahead, each with who it is opened for. Only the people
// given are named, so the caller passes the active ones.
export function listClosedDays(
  business: BusinessHoursInputType,
  people: Map<string, PersonHoursInputType>,
  now: Date
): ClosedDayType[] {
  const today = localDate(now, business.timezone);
  const hasDate = (dateHours: DateHoursType, date: string) =>
    dateHours.some((entry) => entry.date === date);
  return closedDaysBetween(business, today, addDays(today, DAYS_OFF_AHEAD)).map((day) => ({
    ...day,
    openedForEveryone: hasDate(business.dateHours, day.date),
    openedFor: [...people]
      .filter(([, row]) => hasDate(row.dateHours, day.date))
      .map(([personId]) => personId),
  }));
}

// What opening a closed day writes. For everyone: a date the business closed leaves its closed
// dates, and a date still closed after that (a picked holiday) gets a business one-off date on the
// business's usual hours for that weekday. For one person: a one-off date on their row, on their
// usual hours (their own week, or the business's when they follow it). Never a day that is not
// closed for them, and never a weekday they do not work: there would be no hours to open it on.
export function applyOpeningRules(
  business: BusinessHoursInputType,
  person: PersonHoursInputType | null, // null = for everyone; a person with no row: no week, no dates
  date: string, // YYYY-MM-DD
  now: Date
): OpeningType {
  // The booking window's own answer, over the page's year, so the two never disagree.
  const closed = applyBookableHoursRules(
    { ...business, horizonDays: DAYS_OFF_AHEAD },
    person,
    now
  ).closedDates;
  if (!closed.includes(date)) return { ok: false, reason: "not_closed" };

  const week = person?.weeklyHours ?? business.weeklyHours;
  const windows = week[weekdayOf(date)] ?? [];
  if (windows.length === 0) return { ok: false, reason: "no_usual_hours" };
  const withDate = (dateHours: DateHoursType) =>
    [...dateHours, { date, windows }].sort((a, b) => a.date.localeCompare(b.date));

  if (person) return { ok: true, whose: "person", dateHours: withDate(person.dateHours) };

  const closedDates = business.closedDates.filter((closedDate) => closedDate !== date);
  const stillClosed = closedDaysBetween({ ...business, closedDates }, date, date).length > 0;
  return {
    ok: true,
    whose: "business",
    closedDates,
    dateHours: stillClosed ? withDate(business.dateHours) : business.dateHours,
  };
}
