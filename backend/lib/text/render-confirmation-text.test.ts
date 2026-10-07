// The confirmation text's words: short, plain, one piece (feature 8b, decision 4).

import { describe, expect, test } from "vitest";

import { formatTextTime } from "./format-text-time.js";
import { plainText } from "./plain-text.js";
import { renderConfirmationText } from "./render-confirmation-text.js";

const EDMONTON = "America/Edmonton";
const ONE_PIECE = 160; // plain characters in one billed piece
const PLAIN = /^[\x20-\x5f\x61-\x7e]*$/; // printable ASCII without the backtick

// The longest app address the texts are planned for, and a packed link's 45 characters.
const link = `https://app.scheduleads-mail.com/b/${"D".repeat(22)}.${"m".repeat(22)}`;

describe("formatTextTime", () => {
  test.each([
    ["a morning", "2026-10-13T13:30:00Z", "Tue Oct 13, 7:30am"],
    ["noon on the hour", "2026-10-13T18:00:00Z", "Tue Oct 13, 12:00pm"],
    ["an evening", "2026-10-16T01:15:00Z", "Thu Oct 15, 7:15pm"],
  ])("%s in the business's zone: %s is %s", (_, moment, expected) => {
    expect(formatTextTime(new Date(moment), EDMONTON)).toBe(expected);
  });
});

test("another business's zone says its own time", () => {
  expect(formatTextTime(new Date("2026-10-13T13:30:00Z"), "America/Toronto")).toBe(
    "Tue Oct 13, 9:30am"
  );
});

describe("plainText", () => {
  test.each([
    ["accents lose their mark", "Café Lumière", "Cafe Lumiere"],
    ["a curly apostrophe becomes a plain one", "Jane’s Spa", "Jane's Spa"],
    ["curly quotes become plain ones", "“Primo”", '"Primo"'],
    ["a long dash becomes a hyphen", "Face — Body", "Face - Body"],
    ["special spaces become plain ones", "7:30 a.m. MDT", "7:30 a.m. MDT"],
    ["the backtick goes: texts cannot carry it", "Primo`s", "Primos"],
    ["anything else outside the plain set goes", "Summit ☀ Painting", "Summit  Painting"],
  ])("%s", (_, typed, expected) => {
    expect(plainText(typed)).toBe(expected);
  });
});

describe("renderConfirmationText", () => {
  test("only the business, the time and the link", () => {
    expect(
      renderConfirmationText({
        businessName: "Summit Painting",
        startsAt: new Date("2026-10-13T13:30:00Z"),
        timezone: EDMONTON,
        bookingPageUrl: link,
      })
    ).toBe(`Summit Painting: booked Tue Oct 13, 7:30am. Details or changes: ${link}`);
  });

  test.each([
    "Summit Painting (dev)",
    "The Latam Painters",
    "Face and Body Clinic",
    "Primo Painters",
  ])(
    "with an app address of up to 30 characters, %s's confirmation is plain and one piece",
    (businessName) => {
      // The longest time a text can say: a Wednesday in September, past ten.
      const text = renderConfirmationText({
        businessName,
        startsAt: new Date("2026-09-30T17:45:00Z"),
        timezone: EDMONTON,
        bookingPageUrl: link,
      });

      expect(text).toMatch(PLAIN);
      expect(text.length).toBeLessThanOrEqual(ONE_PIECE);
    }
  );

  test("a business name with accents or curly quotes still makes a plain text", () => {
    const text = renderConfirmationText({
      businessName: "L’Atelier Clémence",
      startsAt: new Date("2026-10-13T13:30:00Z"),
      timezone: EDMONTON,
      bookingPageUrl: link,
    });

    expect(text.startsWith("L'Atelier Clemence: booked")).toBe(true);
    expect(text).toMatch(PLAIN);
  });
});
