// Backend: the dates of the holidays a business picked to close.

import { holidayPackage } from "./holiday-package.js";

// The picked holidays from firstDate to lastDate, both included, each date with its name. A pick the
// package no longer knows closes nothing and never fails: the other picks still close, and the
// Days off page shows it to untick.
export function closedHolidays(
  country: string | null,
  region: string | null,
  names: string[],
  firstDate: string,
  lastDate: string
): { date: string; name: string }[] {
  if (names.length === 0 || !country) return [];
  const picked = new Set(names);
  const closed = new Map<string, { date: string; name: string }>(); // province and country both list some
  for (const holiday of holidayPackage.holidaysBetween(country, region, firstDate, lastDate)) {
    if (picked.has(holiday.name))
      closed.set(`${holiday.date} ${holiday.name}`, { date: holiday.date, name: holiday.name });
  }
  return [...closed.values()];
}
