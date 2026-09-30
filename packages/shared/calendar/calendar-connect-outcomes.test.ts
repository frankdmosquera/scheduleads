import { describe, expect, test } from "vitest";

import { calendarConnectOutcomes, isCalendarConnectOutcome } from "./calendar-connect-outcomes.js";

describe("isCalendarConnectOutcome", () => {
  test("each of the five outcomes counts", () => {
    for (const outcome of calendarConnectOutcomes)
      expect(isCalendarConnectOutcome(outcome)).toBe(true);
  });

  test("any other word does not, including the names every object carries", () => {
    for (const word of [
      "constructor",
      "toString",
      "__proto__",
      "hasOwnProperty",
      "",
      "Connected",
    ]) {
      expect(isCalendarConnectOutcome(word)).toBe(false);
    }
    expect(isCalendarConnectOutcome(null)).toBe(false);
    expect(isCalendarConnectOutcome(undefined)).toBe(false);
  });
});
