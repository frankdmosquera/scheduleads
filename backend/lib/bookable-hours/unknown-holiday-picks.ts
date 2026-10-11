// Backend: the holiday picks the package no longer knows. The booking window logs them, the save
// refuses them, and the Days off page shows them to untick.

import { holidayPackage } from "./holiday-package.js";

// A pick the lists have in no year from today's to ten years ahead. One that only skips a year,
// such as a substitute day, still counts: it closes nothing that year and comes back.
export function unknownHolidayPicks(
  country: string | null,
  region: string | null,
  names: string[],
  today: string // YYYY-MM-DD
): string[] {
  if (names.length === 0) return [];
  if (!country) return names;
  const known = holidayPackage.namesFrom(country, region, Number(today.slice(0, 4)));
  return names.filter((name) => !known.has(name));
}
