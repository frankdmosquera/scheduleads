import { describe, expect, test } from "vitest";

import { closedHolidays } from "./closed-holidays.js";
import { unknownHolidayPicks } from "./unknown-holiday-picks.js";

describe("picks the holiday list no longer has", () => {
  test("a holiday that skips the coming year is kept; only a renamed one is gone", () => {
    // A Texas business closed every main holiday in October 2026, the substitute day among them.
    // In January 2028 the next substitute Independence Day is in 2032, but the list still has it.
    const picks = ["Independence Day (substitute day)", "Famly Day", "Christmas Day"];
    expect(unknownHolidayPicks("US", "TX", picks, "2028-01-10")).toEqual(["Famly Day"]);
    // It closes nothing in a year it does not fall in, and its day in a year it does.
    expect(closedHolidays("US", "TX", picks, "2028-01-10", "2029-01-09")).toEqual([
      { date: "2028-12-25", name: "Christmas Day" },
    ]);
    expect(closedHolidays("US", "TX", [picks[0]], "2032-01-01", "2032-12-31")).toEqual([
      { date: "2032-07-05", name: "Independence Day (substitute day)" },
    ]);
  });

  test("with no country, every pick is gone; a province the list does not know has none", () => {
    expect(unknownHolidayPicks(null, null, ["Canada Day"], "2026-10-11")).toEqual(["Canada Day"]);
    expect(unknownHolidayPicks("CA", "ZZ", ["Canada Day"], "2026-10-11")).toEqual(["Canada Day"]);
    expect(unknownHolidayPicks("CA", "AB", [], "2026-10-11")).toEqual([]);
  });
});
