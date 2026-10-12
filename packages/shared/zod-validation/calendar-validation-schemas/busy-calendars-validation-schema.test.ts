import { describe, expect, it } from "vitest";

import {
  BUSY_CALENDARS_MAX,
  busyCalendarsValidationSchema,
} from "./busy-calendars-validation-schema.js";

describe("busyCalendarsValidationSchema", () => {
  it("keeps a pick, and an empty one (nothing counts)", () => {
    expect(busyCalendarsValidationSchema.parse({ calendarIds: ["primary", "work@group"] })).toEqual(
      {
        calendarIds: ["primary", "work@group"],
      }
    );
    expect(busyCalendarsValidationSchema.parse({ calendarIds: [] })).toEqual({ calendarIds: [] });
  });

  it("refuses a calendar picked twice", () => {
    expect(
      busyCalendarsValidationSchema.safeParse({ calendarIds: ["primary", "primary"] }).success
    ).toBe(false);
  });

  it("refuses more calendars than Google reads in one call", () => {
    const ids = Array.from({ length: BUSY_CALENDARS_MAX + 1 }, (_, n) => `calendar-${n}`);
    expect(busyCalendarsValidationSchema.safeParse({ calendarIds: ids }).success).toBe(false);
    expect(busyCalendarsValidationSchema.safeParse({ calendarIds: ids.slice(1) }).success).toBe(
      true
    );
  });

  it("refuses an empty id and anything extra", () => {
    expect(busyCalendarsValidationSchema.safeParse({ calendarIds: [""] }).success).toBe(false);
    expect(
      busyCalendarsValidationSchema.safeParse({ calendarIds: [], resourceId: "someone" }).success
    ).toBe(false);
  });
});
