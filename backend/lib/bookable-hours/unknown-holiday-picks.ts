// Backend: the holiday picks the package no longer knows, for the booking window to log.

import { holidayPackage } from "./holiday-package.js";

// Looked for from today to the end of next year, so a holiday later in the year still counts.
export function unknownHolidayPicks(
  country: string | null,
  region: string | null,
  names: string[],
  today: string // YYYY-MM-DD
): string[] {
  if (names.length === 0) return [];
  if (!country) return names;
  const lastDate = `${Number(today.slice(0, 4)) + 1}-12-31`;
  const known = new Set(
    holidayPackage.holidaysBetween(country, region, today, lastDate).map((holiday) => holiday.name)
  );
  return names.filter((name) => !known.has(name));
}
