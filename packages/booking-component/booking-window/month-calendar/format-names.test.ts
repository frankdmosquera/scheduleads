import { describe, expect, it } from "vitest";

import { formatDayName } from "./format-day-name.js";
import { formatMonthName } from "./format-month-name.js";
import { formatTimeOfDay } from "./format-time-of-day.js";
import { formatZoneName } from "./format-zone-name.js";

describe("the calendar's words", () => {
  it("names a day button in full, for a screen reader as much as the eye", () => {
    expect(formatDayName("2026-10-14")).toBe("Wednesday, October 14");
  });

  it("names the month heading", () => {
    expect(formatMonthName("2026-10")).toBe("October 2026");
  });

  it("says a time on the business's clock, whatever the browser's zone", () => {
    expect(formatTimeOfDay("2026-10-14T15:30:00.000Z", "America/Edmonton")).toBe("9:30 a.m.");
    expect(formatTimeOfDay("2026-10-14T15:30:00.000Z", "America/Toronto")).toBe("11:30 a.m.");
  });

  it("names the zone the same way in summer and winter", () => {
    expect(formatZoneName("America/Edmonton")).toBe("Mountain Time");
  });
});
