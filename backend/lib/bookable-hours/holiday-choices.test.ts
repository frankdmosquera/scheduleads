import { describe, expect, test } from "vitest";

import { holidayChoices } from "./holiday-choices.js";
import { holidayPackage } from "./holiday-package.js";

const year = (country: string, region: string | null) =>
  holidayChoices(country, region, "2026-10-11", "2027-10-11");
const names = (country: string, region: string | null) =>
  year(country, region).map((choice) => choice.name);

describe("the holiday picker's list", () => {
  test("Alberta's year: its nine statutory holidays, soonest first, none twice", () => {
    expect(names("CA", "AB")).toEqual([
      "Thanksgiving",
      "Remembrance Day",
      "Christmas Day",
      "New Year's Day",
      "Family Day",
      "Good Friday",
      "Victoria Day",
      "Canada Day",
      "Labour Day",
    ]);
    expect(year("CA", "AB")[0].dates).toEqual(["2026-10-12", "2027-10-11"]);
    // Days people still work in Alberta are left to close by hand.
    for (const notStatutory of [
      "Halloween",
      "Mother's Day",
      "Easter Monday",
      "Heritage Day",
      "National Day for Truth and Reconciliation",
    ])
      expect(names("CA", "AB")).not.toContain(notStatutory);
  });

  test("a picked state's own list decides: no day it does not keep, nothing twice", () => {
    // Colorado and California do not keep Columbus Day; the country does.
    expect(names("US", null)).toContain("Columbus Day");
    expect(names("US", "CO")).not.toContain("Columbus Day");
    expect(names("US", "CA")).not.toContain("Columbus Day");
    // Alabama's own name for January 18 is the only one listed for it.
    const january18 = year("US", "AL").filter((choice) => choice.dates.includes("2027-01-18"));
    expect(january18).toHaveLength(1);
  });

  test("only Canada, Colombia and the United States are offered; Colombia has no provinces", () => {
    expect(holidayPackage.countries().map((country) => country.code)).toEqual(["CA", "CO", "US"]);
    expect(holidayPackage.regions("CO")).toEqual([]);
    expect(holidayPackage.regions("US")?.some((state) => state.code === "TX")).toBe(true);
    expect(holidayPackage.regions("DE")).toBeNull();
    expect(year("CO", null).find((choice) => choice.name === "Christmas Day")).toEqual({
      name: "Christmas Day",
      label: "Christmas Day",
      dates: ["2026-12-25"],
    });
  });

  // Feature 12j: the two languages' lists are paired by date, so a substitute day never borrows
  // the real day's name.
  test("each holiday carries its Spanish name, paired by date", () => {
    const usHolidays = holidayPackage.holidaysBetween("US", null, "2026-07-01", "2026-07-31");
    expect(usHolidays).toEqual([
      {
        name: "Independence Day (substitute day)",
        spanishName: "Día de la Independencia (día sustituto)",
        date: "2026-07-03",
      },
      { name: "Independence Day", spanishName: "Día de la Independencia", date: "2026-07-04" },
    ]);
    expect(holidayPackage.nameOn("CO", null, "Christmas Day", "2026-12-25", "es")).toBe("Navidad");
    expect(holidayPackage.nameOn("CO", null, "Christmas Day", "2026-12-25", "en")).toBe(
      "Christmas Day"
    );
    expect(holidayPackage.nameOn("CA", "AB", "Family Day", "2027-02-15", "es")).toBe("Family Day");
  });
});
