import { describe, expect, test } from "vitest";

import { addDays, localDate, localTimeToMoment } from "./local-time.js";

// Alberta stopped changing its clocks in 2026, so the clock changes are proved in Denver.
describe("localTimeToMoment", () => {
  test("an ordinary clock time", () => {
    expect(localTimeToMoment("2026-10-05", 540, "America/Edmonton")?.toISOString()).toBe(
      "2026-10-05T15:00:00.000Z"
    );
  });

  test("a time the spring change skips does not exist", () => {
    expect(localTimeToMoment("2027-03-14", 150, "America/Denver")).toBeNull(); // 2:30
  });

  test("a time the autumn change repeats is its first occurrence", () => {
    expect(localTimeToMoment("2026-11-01", 90, "America/Denver")?.toISOString()).toBe(
      "2026-11-01T07:30:00.000Z" // 1:30 MDT, not 1:30 MST (8:30Z)
    );
  });

  test("a zone ahead of UTC, with a half-hour offset", () => {
    expect(localTimeToMoment("2026-10-05", 540, "Asia/Kolkata")?.toISOString()).toBe(
      "2026-10-05T03:30:00.000Z"
    );
  });

  test("midnight and the last minute of the day", () => {
    expect(localTimeToMoment("2026-10-05", 0, "America/Edmonton")?.toISOString()).toBe(
      "2026-10-05T06:00:00.000Z"
    );
    expect(localTimeToMoment("2026-10-05", 1439, "America/Edmonton")?.toISOString()).toBe(
      "2026-10-06T05:59:00.000Z"
    );
  });
});

describe("localDate and addDays", () => {
  test("late evening in Edmonton is still that day, though UTC is on the next", () => {
    expect(localDate(new Date("2026-10-06T05:00:00Z"), "America/Edmonton")).toBe("2026-10-05");
  });

  test("adding days crosses months and the clock change without drifting", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
  });
});
