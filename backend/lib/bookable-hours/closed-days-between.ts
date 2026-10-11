// Backend: a business's closed days between two dates: the dates it closed and the dates of the
// holidays it picked. The one list the booking window and the Days off page both read.

import type { BusinessHoursInputType } from "./apply-bookable-hours-rules.js";
import { closedHolidays } from "./closed-holidays.js";

export type ClosedDateType = { date: string; name: string | null }; // name: the holiday's, or null

// Sorted by date, one entry per date; a date both closed and a holiday carries the holiday's name.
export function closedDaysBetween(
  business: Pick<
    BusinessHoursInputType,
    "closedDates" | "holidayCountry" | "holidayRegion" | "closedHolidays"
  >,
  firstDate: string, // YYYY-MM-DD, included
  lastDate: string // YYYY-MM-DD, included
): ClosedDateType[] {
  const byDate = new Map<string, string | null>();
  for (const date of business.closedDates) {
    if (date >= firstDate && date <= lastDate) byDate.set(date, null); // YYYY-MM-DD sorts as text
  }
  const holidays = closedHolidays(
    business.holidayCountry,
    business.holidayRegion,
    business.closedHolidays,
    firstDate,
    lastDate
  );
  for (const holiday of holidays)
    byDate.set(holiday.date, byDate.get(holiday.date) ?? holiday.name);
  return [...byDate]
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
