import { describe, expect, it } from "vitest";

import { formatDayName } from "./format-day-name.js";
import { formatMonthName } from "./format-month-name.js";
import { formatZoneName } from "./format-zone-name.js";

describe("the calendar's words", () => {
  it("names a day button in full, for a screen reader as much as the eye", () => {
    expect(formatDayName("2026-10-14")).toBe("Wednesday, October 14");
  });

  it("names the month heading", () => {
    expect(formatMonthName("2026-10")).toBe("October 2026");
  });

  it("names the zone the same way in summer and winter", () => {
    expect(formatZoneName("America/Edmonton")).toBe("Mountain Time");
  });
});
