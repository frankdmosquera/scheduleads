import { describe, expect, test } from "vitest";

import { holidayChoices } from "./holiday-choices.js";
import { holidayPackage } from "./holiday-package.js";

describe("the holiday picker's list", () => {
  test("Alberta's year: the nine main ones first, then every other day, none twice", () => {
    const choices = holidayChoices("CA", "AB", "2026-10-11", "2027-10-11");

    expect(choices.filter((choice) => choice.main).map((choice) => choice.name)).toEqual([
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
    expect(choices.find((choice) => choice.name === "Thanksgiving")?.dates).toEqual([
      "2026-10-12",
      "2027-10-11",
    ]);
    // Listed, not main: a national day, and Alberta's own optional ones.
    const others = choices.filter((choice) => !choice.main).map((choice) => choice.name);
    expect(others).toContain("National Day for Truth and Reconciliation");
    expect(others).toContain("Heritage Day");
    expect(choices.findIndex((choice) => !choice.main)).toBe(9); // after the main ones
    expect(new Set(choices.map((choice) => choice.name)).size).toBe(choices.length);
  });

  test("only Canada, Colombia and the United States are offered; Colombia has no provinces", () => {
    expect(holidayPackage.countries().map((country) => country.code)).toEqual(["CA", "CO", "US"]);
    expect(holidayPackage.regions("CO")).toEqual([]);
    expect(holidayPackage.regions("US")?.some((state) => state.code === "TX")).toBe(true);
    expect(holidayPackage.regions("DE")).toBeNull();
    expect(
      holidayChoices("CO", null, "2026-10-11", "2027-10-11").find((c) => c.name === "Christmas Day")
    ).toEqual({ name: "Christmas Day", dates: ["2026-12-25"], main: true });
  });
});
