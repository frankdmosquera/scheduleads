// The rule that lists a service's bookings that would no longer fit at its new length. Each case is
// one on the feature's Simulate page, under the same name. Times are Edmonton's: MDT is UTC-6 in
// October.

import { describe, expect, test } from "vitest";

import { applyLengthChangeRules } from "./apply-length-change-rules.js";
import type { HoursRowsType } from "./apply-outside-hours-rules.js";

const now = new Date("2026-10-10T12:00:00Z"); // Saturday; Tuesday the 13th is still to come

// Tuesdays 9:00 to 5:00, or the windows given.
const hours = (tue = [{ startMinute: 540, endMinute: 1020 }]): HoursRowsType => ({
  timezone: "America/Edmonton",
  weeklyHours: { tue },
  dateHours: [],
  people: new Map(),
});

// A booking of the estimate on Tuesday Oct 13, local clock times in Edmonton.
const tuesday = (from: string, to: string, serviceId = "estimate", status = "confirmed") => ({
  personId: "ana",
  serviceId,
  status,
  startsAt: new Date(`2026-10-13T${from}:00-06:00`),
  endsAt: new Date(`2026-10-13T${to}:00-06:00`),
});

describe("applyLengthChangeRules", () => {
  test("a longer service that runs a booking past the end of the day is listed", () => {
    const maria = tuesday("16:00", "17:00"); // 60 minutes, ending at 5:00
    expect(applyLengthChangeRules(hours(), "estimate", 90, [maria], now)).toEqual([maria]);
  });

  test("a longer service that still fits is not listed", () => {
    const early = tuesday("10:00", "11:00");
    expect(applyLengthChangeRules(hours(), "estimate", 90, [early], now)).toEqual([]);
  });

  test("a shorter service never lists a booking", () => {
    const late = tuesday("16:00", "17:00");
    expect(applyLengthChangeRules(hours(), "estimate", 30, [late], now)).toEqual([]);
  });

  test("a booking already outside before the change is not listed again", () => {
    const outside = tuesday("17:00", "18:00"); // already past 5:00 as booked
    expect(applyLengthChangeRules(hours(), "estimate", 90, [outside], now)).toEqual([]);
  });

  test("a longer booking that would run into a gap between windows is listed", () => {
    // 9:00 to 12:00 and 1:00 to 5:00: an 11:00 hour fits the morning, ninety minutes would not.
    const split = hours([
      { startMinute: 540, endMinute: 720 },
      { startMinute: 780, endMinute: 1020 },
    ]);
    const lunch = tuesday("11:00", "12:00");
    expect(applyLengthChangeRules(split, "estimate", 90, [lunch], now)).toEqual([lunch]);
  });

  test("another service's bookings are never listed", () => {
    const consultation = tuesday("16:00", "17:00", "consultation");
    expect(applyLengthChangeRules(hours(), "estimate", 90, [consultation], now)).toEqual([]);
  });

  test("a cancelled or past booking is never listed", () => {
    const cancelled = tuesday("16:00", "17:00", "estimate", "cancelled");
    const past = tuesday("16:00", "17:00");
    const afterIt = new Date("2026-10-14T12:00:00Z");
    expect(applyLengthChangeRules(hours(), "estimate", 90, [cancelled], now)).toEqual([]);
    expect(applyLengthChangeRules(hours(), "estimate", 90, [past], afterIt)).toEqual([]);
  });
});
