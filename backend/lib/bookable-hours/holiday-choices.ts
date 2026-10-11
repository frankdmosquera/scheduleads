// Backend: the statutory holidays the Days off picker offers, one per name.

import { holidayPackage } from "./holiday-package.js";

export type HolidayChoiceType = {
  name: string;
  dates: string[]; // YYYY-MM-DD, sorted; two when a holiday falls twice in the year shown
};

// Soonest first.
export function holidayChoices(
  country: string,
  region: string | null,
  firstDate: string,
  lastDate: string
): HolidayChoiceType[] {
  const byName = new Map<string, HolidayChoiceType>();
  for (const holiday of holidayPackage.holidaysBetween(country, region, firstDate, lastDate)) {
    const choice = byName.get(holiday.name) ?? { name: holiday.name, dates: [] };
    if (!choice.dates.includes(holiday.date)) choice.dates.push(holiday.date);
    byName.set(holiday.name, choice);
  }
  return [...byName.values()]
    .map((choice) => ({ ...choice, dates: choice.dates.sort() }))
    .sort((a, b) => a.dates[0].localeCompare(b.dates[0]) || a.name.localeCompare(b.name));
}
