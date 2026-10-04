import { describe, expect, test } from "vitest";

import { moveBookingValidationSchema } from "./move-booking-validation-schema.js";

describe("moving a booking", () => {
  test("a start with a person, or with any available", () => {
    expect(
      moveBookingValidationSchema.parse({ startsAt: "2026-10-08T15:30:00Z", personId: "ana-1" })
    ).toEqual({ startsAt: "2026-10-08T15:30:00Z", personId: "ana-1" });
    expect(
      moveBookingValidationSchema.parse({ startsAt: "2026-10-08T15:30:00Z", personId: null })
    ).toEqual({ startsAt: "2026-10-08T15:30:00Z", personId: null });
  });

  test("a start that is not a time, or a person id with other text, is refused", () => {
    expect(moveBookingValidationSchema.safeParse({ startsAt: "Thursday" }).success).toBe(false);
    expect(
      moveBookingValidationSchema.safeParse({ startsAt: "2026-10-08T15:30:00Z", personId: "a b" })
        .success
    ).toBe(false);
  });
});
