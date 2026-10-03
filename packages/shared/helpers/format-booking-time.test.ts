import { describe, expect, test } from "vitest";

import { formatBookingTime } from "./format-booking-time.js";

describe("formatBookingTime", () => {
  test("a booking at 15:00Z reads 9:00 a.m. in Edmonton, the zone named", () => {
    expect(formatBookingTime(new Date("2026-10-08T15:00:00Z"), "America/Edmonton")).toBe(
      "Thursday, October 8 at 9:00 a.m. MDT"
    );
  });

  test("follows the business's zone across the clock change, not the server's", () => {
    // Denver, not Edmonton: the time zone data (2026c) keeps Alberta on daylight time for good.
    expect(formatBookingTime(new Date("2026-11-05T16:00:00Z"), "America/Denver")).toBe(
      "Thursday, November 5 at 9:00 a.m. MST"
    );
    expect(formatBookingTime(new Date("2026-10-08T15:00:00Z"), "America/Toronto")).toBe(
      "Thursday, October 8 at 11:00 a.m. EDT"
    );
  });
});
