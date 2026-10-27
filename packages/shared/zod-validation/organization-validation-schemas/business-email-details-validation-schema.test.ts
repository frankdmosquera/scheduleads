import { describe, expect, test } from "vitest";

import { businessEmailDetailsValidationSchema } from "./business-email-details-validation-schema.js";

const message = (details: Record<string, unknown>) =>
  businessEmailDetailsValidationSchema.safeParse(details).error?.issues[0]?.message;

describe("the business's email details", () => {
  test("filled in, trimmed, the addresses and the colour lowercased", () => {
    expect(
      businessEmailDetailsValidationSchema.parse({
        senderEmail: " Bookings@Primo.com ",
        notifyEmail: "Office@Primo.com",
        phone: " 403 555 0100 ",
        website: "https://primopainters.com",
        brandColor: "#1D4ED8",
      })
    ).toEqual({
      senderEmail: "bookings@primo.com",
      notifyEmail: "office@primo.com",
      phone: "403 555 0100",
      website: "https://primopainters.com",
      brandColor: "#1d4ed8",
    });
  });

  test("every one may be left empty", () => {
    const empty = { senderEmail: "", notifyEmail: "", phone: "", website: "", brandColor: "" };
    expect(businessEmailDetailsValidationSchema.parse(empty)).toEqual(empty);
    expect(businessEmailDetailsValidationSchema.parse({})).toEqual({});
  });

  test.each([
    ["a colour name", { brandColor: "blue" }, "Use a colour like #1d4ed8."],
    ["a short colour", { brandColor: "#fff" }, "Use a colour like #1d4ed8."],
    [
      "a website without https",
      { website: "http://primo.com" },
      "Use the full website address, starting https://",
    ],
    [
      "a website that is a word",
      { website: "primo" },
      "Use the full website address, starting https://",
    ],
    ["a sender that is not an email", { senderEmail: "bookings" }, "Enter a valid email address."],
    ["a phone too long", { phone: "1".repeat(41) }, "That phone number is too long."],
    ["a phone of only spaces", { phone: "   " }, "Enter a phone number, or leave it empty."],
  ])("%s is refused", (_name, details, expected) => {
    expect(message(details)).toBe(expected);
  });
});
