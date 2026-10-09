// Which tally a booking counts against: one per email and one per phone, inside one business.

import { describe, expect, test } from "vitest";

import { bookingContactKeys } from "./booking-contact-keys.js";

describe("booking contact keys", () => {
  test("a phone written two ways is one phone", () => {
    expect(bookingContactKeys("primo", { phone: "+1 403 555 0177" })).toEqual(
      bookingContactKeys("primo", { phone: "403-555-0177" })
    );
  });

  test("an email in capitals and spaces is the same email", () => {
    expect(bookingContactKeys("primo", { email: " Jane@Example.com " })).toEqual(
      bookingContactKeys("primo", { email: "jane@example.com" })
    );
  });

  test("two businesses never share a key", () => {
    const contact = { email: "jane@example.com", phone: "403 555 0177" };
    const primo = bookingContactKeys("primo", contact);
    const clinic = bookingContactKeys("face-and-body", contact);
    expect(primo).toHaveLength(2);
    expect(primo.some((key) => clinic.includes(key))).toBe(false);
  });

  test("a number that cannot be texted counts by its digits", () => {
    expect(bookingContactKeys("primo", { phone: "+44 20 7946 0958" })).toEqual([
      "primo:phone:442079460958",
    ]);
  });

  test("a phone with no digits, or no phone, adds no key", () => {
    expect(bookingContactKeys("primo", { email: "jane@example.com", phone: "none" })).toEqual([
      "primo:email:jane@example.com",
    ]);
    expect(bookingContactKeys("primo", { email: "jane@example.com" })).toHaveLength(1);
  });
});
