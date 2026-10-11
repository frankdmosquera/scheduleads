// Backend: the holidays the Days off picker offers, one per name.

import { holidayPackage } from "./holiday-package.js";

export type HolidayChoiceType = {
  name: string;
  dates: string[]; // YYYY-MM-DD, sorted; two when a holiday falls twice in the year shown
  main: boolean; // a public holiday, ticked by "Close all main holidays"
};

// The main ones first, then the rest, each soonest first. School terms are left out: they are
// ranges, not days.
export function holidayChoices(
  country: string,
  region: string | null,
  firstDate: string,
  lastDate: string
): HolidayChoiceType[] {
  const byName = new Map<string, HolidayChoiceType>();
  for (const holiday of holidayPackage.holidaysBetween(country, region, firstDate, lastDate)) {
    if (holiday.type === "school") continue;
    const choice = byName.get(holiday.name) ?? { name: holiday.name, dates: [], main: false };
    if (!choice.dates.includes(holiday.date)) choice.dates.push(holiday.date); // province and country both list it
    choice.main ||= holiday.type === "public";
    byName.set(holiday.name, choice);
  }
  return [...byName.values()]
    .map((choice) => ({ ...choice, dates: choice.dates.sort() }))
    .sort(
      (a, b) =>
        Number(b.main) - Number(a.main) ||
        a.dates[0].localeCompare(b.dates[0]) ||
        a.name.localeCompare(b.name)
    );
}
