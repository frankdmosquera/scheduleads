import { describe, expect, test } from "vitest";

import { localDate } from "./local-date.js";

describe("localDate", () => {
  test("late evening in Edmonton is still that day, though UTC is on the next", () => {
    expect(localDate(new Date("2026-10-06T05:00:00Z"), "America/Edmonton")).toBe("2026-10-05");
  });

  test("a minute either side of midnight turns the month and the year", () => {
    // Regina keeps UTC-6 all year.
    expect(localDate(new Date("2027-01-01T06:01:00Z"), "America/Regina")).toBe("2027-01-01");
    expect(localDate(new Date("2027-01-01T05:59:00Z"), "America/Regina")).toBe("2026-12-31");
  });

  test("the night the clocks go back keeps one date for its two 1:30s", () => {
    // Nov 1 2026, New York: 1:30 EDT (05:30Z), then 1:30 EST (06:30Z).
    expect(localDate(new Date("2026-11-01T05:30:00Z"), "America/New_York")).toBe("2026-11-01");
    expect(localDate(new Date("2026-11-01T06:30:00Z"), "America/New_York")).toBe("2026-11-01");
  });
});
