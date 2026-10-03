import { describe, expect, test } from "vitest";

import { createBookingValidationSchema } from "./create-booking-validation-schema.js";

const form = {
  bookingLinkId: "3f6c1d2e-0b4a-4c1e-9a77-5d2f8e9b1c00",
  startsAt: "2026-10-05T15:00:00.000Z",
  customer: { name: "Jane Doe", email: "jane@example.com" },
  location: "12 Elm Street",
};

const message = (body: Record<string, unknown>) =>
  createBookingValidationSchema.safeParse(body).error?.issues[0]?.message;

describe("the booking form", () => {
  test("a filled form, trimmed, the email lowercased", () => {
    expect(
      createBookingValidationSchema.parse({
        ...form,
        customer: { name: " Jane Doe ", email: "Jane@Example.com", phone: " 555 0100 " },
        location: " 12 Elm Street ",
        details: " The front room ",
      })
    ).toEqual({
      ...form,
      customer: { name: "Jane Doe", email: "jane@example.com", phone: "555 0100" },
      location: "12 Elm Street",
      details: "The front room",
    });
  });

  test("an email or a phone, either one is enough (decision 16)", () => {
    expect(message(form)).toBeUndefined();
    expect(message({ ...form, customer: { name: "Jane Doe", phone: "555 0100" } })).toBeUndefined();
  });

  test("neither an email nor a phone is refused", () => {
    expect(message({ ...form, customer: { name: "Jane Doe" } })).toBe(
      "Enter an email or a phone number. At least one is required."
    );
  });

  test("a start with an offset is an instant too", () => {
    expect(message({ ...form, startsAt: "2026-10-05T09:00:00-06:00" })).toBeUndefined();
  });

  test.each([
    ["a date alone", "2026-10-05"],
    ["a time with no zone", "2026-10-05T09:00:00"],
    ["words", "Monday at nine"],
  ])("%s is not a start", (_name, startsAt) => {
    expect(message({ ...form, startsAt })).toBe("Pick one of the times offered.");
  });

  test.each([
    ["an empty address", { location: "   " }, "Enter the address."],
    ["no address", { location: undefined }, "Enter the address."],
    ["an address over 300 characters", { location: "a".repeat(301) }, "That address is too long."],
    ["words over 2000 characters", { details: "a".repeat(2001) }, "Keep it to 2000 characters."],
    ["a person id with a quote", { personId: "abc'def" }, "That is not a person id."],
    ["a form key with a space", { requestKey: "abc def" }, "That is not a booking form key."],
    [
      "a booking link id with a quote",
      { bookingLinkId: "abc'def" },
      "That is not a booking link id.",
    ],
    ["an empty phone", { customer: { name: "Jane Doe", phone: "" } }, "Enter a phone number."],
  ])("%s is refused", (_name, change, expected) => {
    expect(message({ ...form, ...change })).toBe(expected);
  });
});
