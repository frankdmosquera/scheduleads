import { describe, expect, it } from "vitest";

import { bookableMonths } from "./bookable-months.js";
import { datesToAsk } from "./dates-to-ask.js";
import { shiftMonth } from "./shift-month.js";

// Today is Oct 9 2026 and the business books 60 days ahead: the last date is Dec 8.
const bounds = bookableMonths("2026-10-09", 60);

describe("how far the calendar reaches", () => {
  it("runs from today's month to the month of the last bookable date", () => {
    expect(bounds).toEqual({
      today: "2026-10-09",
      lastDate: "2026-12-08",
      firstMonth: "2026-10",
      lastMonth: "2026-12",
    });
  });

  it("asks this month from today, never a past day", () => {
    expect(datesToAsk("2026-10", bounds)).toEqual({ from: "2026-10-09", to: "2026-10-31" });
  });

  it("asks a whole month in the middle: 30 dates, inside the route's 31", () => {
    expect(datesToAsk("2026-11", bounds)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  });

  it("asks the last month only up to the last bookable date", () => {
    expect(datesToAsk("2026-12", bounds)).toEqual({ from: "2026-12-01", to: "2026-12-08" });
  });

  it("has nothing to ask before this month or past the last date", () => {
    expect(datesToAsk("2026-09", bounds)).toBeNull();
    expect(datesToAsk("2027-01", bounds)).toBeNull();
  });

  it("steps across a year end both ways", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
  });

  it("stays inside one month when the horizon is 0: only today", () => {
    const todayOnly = bookableMonths("2026-10-31", 0);
    expect(todayOnly.lastMonth).toBe("2026-10");
    expect(datesToAsk("2026-10", todayOnly)).toEqual({ from: "2026-10-31", to: "2026-10-31" });
  });
});
