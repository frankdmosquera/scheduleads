import { describe, expect, test } from "vitest";

import { businessNameValidationSchema } from "./business-name-validation-schema.js";

const message = (name: string) =>
  businessNameValidationSchema.safeParse(name).error?.issues[0]?.message;

describe("a business's name", () => {
  test("making a business with the slug bookings is refused", () => {
    expect(message("Bookings")).toBe("That name is taken by the app. Add a word to it.");
    expect(message(" bookings! ")).toBe("That name is taken by the app. Add a word to it.");
  });

  test("a name that only contains the word is fine", () => {
    expect(businessNameValidationSchema.parse("Primo Bookings")).toBe("Primo Bookings");
  });
});
