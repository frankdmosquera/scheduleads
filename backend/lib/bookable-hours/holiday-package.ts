// Backend: the holiday package, behind one object. The only file that imports it; a holiday is
// named by its English name, such as "Family Day", and carries its Spanish name to show (feature
// 12j), the English one where the package has no Spanish. Only statutory holidays are ever used: the
// package's "public" ones, a real day off where the business is. Observances (Halloween, Mother's
// Day), optional days and school terms are left to the owner to close by hand.

import Holidays from "date-holidays";

export type HolidayPlaceType = { code: string; name: string };
export type PackageHolidayType = { name: string; spanishName: string; date: string }; // date YYYY-MM-DD
export type HolidayLanguageType = "en" | "es";

const OFFERED_COUNTRIES = ["CA", "CO", "US"]; // the countries the businesses are in
// How far ahead a name is looked for before it counts as gone: a substitute day or an election
// day skips years, and comes back.
const YEARS_A_NAME_IS_LOOKED_FOR = 10;

const catalogue = new Holidays(); // the package's countries and provinces
const holidayLists = new Map<string, Holidays>(); // one per country or province, built once
// A year's holidays never change while the server runs, so each is worked out once.
const yearsHolidays = new Map<string, PackageHolidayType[]>();
const knownNames = new Map<string, Set<string>>();

const knowsCountry = (country: string) => Boolean(catalogue.getCountries("en")[country]);
const knowsRegion = (country: string, region: string) =>
  Boolean(catalogue.getStates(country, "en")?.[region]);
const byName = (a: HolidayPlaceType, b: HolidayPlaceType) => a.name.localeCompare(b.name);

function holidayList(
  key: string,
  country: string,
  region: string | null,
  language: HolidayLanguageType
): Holidays {
  let list = holidayLists.get(`${key} ${language}`);
  if (!list) {
    list = region
      ? new Holidays(country, region, { languages: [language] })
      : new Holidays(country, { languages: [language] });
    holidayLists.set(`${key} ${language}`, list);
  }
  return list;
}

const statutory = (list: Holidays, year: number) =>
  list.getHolidays(year).filter((holiday) => holiday.type === "public");

// One year of one list's statutory holidays: the province's, or the country's.
function holidaysOfYear(country: string, region: string | null, year: number) {
  const key = region ? `${country}-${region}` : country;
  let holidays = yearsHolidays.get(`${key} ${year}`);
  if (!holidays) {
    // The two languages' lists come in the same order; a pair whose dates differ keeps the English.
    const spanish = statutory(holidayList(key, country, region, "es"), year);
    holidays = statutory(holidayList(key, country, region, "en"), year).map((holiday, index) => ({
      name: holiday.name,
      spanishName: spanish[index]?.date === holiday.date ? spanish[index].name : holiday.name,
      date: holiday.date.slice(0, 10), // "2027-02-15 00:00:00", local to the province
    }));
    yearsHolidays.set(`${key} ${year}`, holidays);
  }
  return holidays;
}

// A business's statutory holidays for one year: its province's own list when one is picked (the
// package's province list already carries the national holidays the province keeps, under the
// province's names and dates), otherwise the country's. None for a country or province the package
// does not know: it would quietly use the national list for a bad province.
function holidaysOfPlace(country: string, region: string | null, year: number) {
  if (!knowsCountry(country) || (region && !knowsRegion(country, region))) return [];
  return holidaysOfYear(country, region, year);
}

export const holidayPackage = {
  // The countries the picker offers, by name; in Spanish from the runtime's own names, which the
  // package does not have.
  countries(language: HolidayLanguageType = "en"): HolidayPlaceType[] {
    const names = catalogue.getCountries("en");
    const spanish = new Intl.DisplayNames(["es"], { type: "region" });
    return OFFERED_COUNTRIES.map((code) => ({
      code,
      name: language === "es" ? (spanish.of(code) ?? names[code] ?? code) : (names[code] ?? code),
    })).sort(byName);
  },

  // A country's provinces, by name (none for Colombia); null for a country not offered.
  regions(country: string): HolidayPlaceType[] | null {
    if (!OFFERED_COUNTRIES.includes(country) || !knowsCountry(country)) return null;
    return Object.entries(catalogue.getStates(country, "en") ?? {})
      .map(([code, name]) => ({ code, name }))
      .sort(byName);
  },

  // Every holiday of the business's province and country from firstDate to lastDate, both included.
  holidaysBetween(
    country: string,
    region: string | null,
    firstDate: string,
    lastDate: string
  ): PackageHolidayType[] {
    const found: PackageHolidayType[] = [];
    for (let year = Number(firstDate.slice(0, 4)); year <= Number(lastDate.slice(0, 4)); year++) {
      for (const holiday of holidaysOfPlace(country, region, year))
        if (holiday.date >= firstDate && holiday.date <= lastDate) found.push(holiday);
    }
    return found;
  },

  // A holiday's name to show on its date: Spanish where the package has it, else its English name.
  nameOn(
    country: string | null,
    region: string | null,
    name: string,
    date: string,
    language: HolidayLanguageType
  ): string {
    if (language === "en" || !country) return name;
    const holiday = holidaysOfPlace(country, region, Number(date.slice(0, 4))).find(
      (one) => one.name === name && one.date === date
    );
    return holiday?.spanishName ?? name;
  },

  // Every name the lists have from this year to ten years ahead: a pick outside it is one the
  // package renamed or dropped.
  namesFrom(country: string, region: string | null, year: number): Set<string> {
    const key = `${country}-${region ?? ""} ${year}`;
    let names = knownNames.get(key);
    if (!names) {
      names = new Set(
        this.holidaysBetween(
          country,
          region,
          `${year}-01-01`,
          `${year + YEARS_A_NAME_IS_LOOKED_FOR}-12-31`
        ).map((holiday) => holiday.name)
      );
      knownNames.set(key, names);
    }
    return names;
  },
};
