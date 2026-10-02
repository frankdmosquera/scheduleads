import { describe, expect, test } from "vitest";

import { countBookingsThatDay } from "./count-bookings-that-day.js";

const MONDAY = "2026-10-05";
const ZONE = "America/Edmonton"; // UTC-6

describe("countBookingsThatDay", () => {
  test("time off never counts", () => {
    const counts = countBookingsThatDay(
      [{ resourceId: "Ana", kind: "time_off", startsAt: new Date("2026-10-05T15:00:00Z") }],
      MONDAY,
      ZONE
    );
    expect(counts.get("Ana")).toBeUndefined();
  });

  test("a booking on another day does not count", () => {
    const counts = countBookingsThatDay(
      [
        { resourceId: "Ana", kind: "booking", startsAt: new Date("2026-10-05T15:00:00Z") },
        { resourceId: "Ana", kind: "booking", startsAt: new Date("2026-10-06T15:00:00Z") },
      ],
      MONDAY,
      ZONE
    );
    expect(counts.get("Ana")).toBe(1);
  });

  test("the day is the business's own date, not the server's", () => {
    // 11:30pm Monday in Edmonton is already Tuesday in UTC; it is still Monday's booking.
    const counts = countBookingsThatDay(
      [{ resourceId: "Ana", kind: "booking", startsAt: new Date("2026-10-06T05:30:00Z") }],
      MONDAY,
      ZONE
    );
    expect(counts.get("Ana")).toBe(1);
  });
});
