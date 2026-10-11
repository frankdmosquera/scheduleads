// Backend: the dates of the holidays a business picked to close. The only file that knows
// the holiday package; a pick is the package's English name, such as "Family Day".

import Holidays from "date-holidays";

const holidayLists = new Map<string, Holidays>(); // one per country or province, built once

function holidayList(country: string, region: string | null): Holidays {
  const key = region ? `${country}-${region}` : country;
  let list = holidayLists.get(key);
  if (!list) {
    list = region
      ? new Holidays(country, region, { languages: ["en"] })
      : new Holidays(country, { languages: ["en"] });
    holidayLists.set(key, list);
  }
  return list;
}

// The picked holidays from firstDate to lastDate, both included, each date with its name, looked
// up in the province's list and the country's own. Throws on an unknown country, province or name
// rather than drop a closure: the package quietly uses the national list for a bad province.
export function closedHolidays(
  country: string | null,
  region: string | null,
  names: string[],
  firstDate: string,
  lastDate: string
): { date: string; name: string }[] {
  if (names.length === 0) return [];
  if (!country) throw new Error("Picked holidays need the country they come from.");

  const catalogue = new Holidays();
  if (!catalogue.getCountries("en")[country]) {
    throw new Error(`The holiday list does not know the country ${country}.`);
  }
  if (region && !catalogue.getStates(country, "en")?.[region]) {
    throw new Error(`The holiday list does not know the province ${country}-${region}.`);
  }

  const lists = region
    ? [holidayList(country, region), holidayList(country, null)]
    : [holidayList(country, null)];
  const datesByName = new Map<string, Set<string>>();
  for (let year = Number(firstDate.slice(0, 4)); year <= Number(lastDate.slice(0, 4)); year++) {
    for (const list of lists) {
      for (const holiday of list.getHolidays(year)) {
        const dates = datesByName.get(holiday.name) ?? new Set<string>();
        dates.add(holiday.date.slice(0, 10)); // "2027-02-15 00:00:00", local to the province
        datesByName.set(holiday.name, dates);
      }
    }
  }

  const closed: { date: string; name: string }[] = [];
  for (const name of names) {
    const dates = datesByName.get(name);
    if (!dates) throw new Error(`The holiday list has no holiday named "${name}".`);
    for (const date of dates)
      if (date >= firstDate && date <= lastDate) closed.push({ date, name });
  }
  return closed;
}
