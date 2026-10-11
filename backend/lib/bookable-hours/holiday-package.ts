// Backend: the holiday package, behind one object. The only file that imports it; a holiday is
// named by its English name, such as "Family Day".

import Holidays from "date-holidays";

export type HolidayPlaceType = { code: string; name: string };
export type PackageHolidayType = { name: string; date: string; type: string }; // date YYYY-MM-DD

const OFFERED_COUNTRIES = ["CA", "CO", "US"]; // the countries the businesses are in

const catalogue = new Holidays(); // the package's countries and provinces
const holidayLists = new Map<string, Holidays>(); // one per country or province, built once

const knowsCountry = (country: string) => Boolean(catalogue.getCountries("en")[country]);
const knowsRegion = (country: string, region: string) =>
  Boolean(catalogue.getStates(country, "en")?.[region]);
const byName = (a: HolidayPlaceType, b: HolidayPlaceType) => a.name.localeCompare(b.name);

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

export const holidayPackage = {
  // The countries the picker offers, by name.
  countries(): HolidayPlaceType[] {
    const names = catalogue.getCountries("en");
    return OFFERED_COUNTRIES.map((code) => ({ code, name: names[code] ?? code })).sort(byName);
  },

  // A country's provinces, by name (none for Colombia); null for a country not offered.
  regions(country: string): HolidayPlaceType[] | null {
    if (!OFFERED_COUNTRIES.includes(country) || !knowsCountry(country)) return null;
    return Object.entries(catalogue.getStates(country, "en") ?? {})
      .map(([code, name]) => ({ code, name }))
      .sort(byName);
  },

  // Every holiday of the province's list and the country's own from firstDate to lastDate, both
  // included. None for a country or province the package does not know: it would quietly use the
  // national list for a bad province.
  holidaysBetween(
    country: string,
    region: string | null,
    firstDate: string,
    lastDate: string
  ): PackageHolidayType[] {
    if (!knowsCountry(country) || (region && !knowsRegion(country, region))) return [];
    const lists = region
      ? [holidayList(country, region), holidayList(country, null)]
      : [holidayList(country, null)];
    const found: PackageHolidayType[] = [];
    for (let year = Number(firstDate.slice(0, 4)); year <= Number(lastDate.slice(0, 4)); year++) {
      for (const list of lists) {
        for (const holiday of list.getHolidays(year)) {
          const date = holiday.date.slice(0, 10); // "2027-02-15 00:00:00", local to the province
          if (date >= firstDate && date <= lastDate)
            found.push({ name: holiday.name, date, type: holiday.type });
        }
      }
    }
    return found;
  },
};
