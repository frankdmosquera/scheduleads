// The reminder text's words: short, plain, one piece (feature 8b, decision 4).

import { describe, expect, test } from "vitest";

import { renderReminderText } from "./render-reminder-text.js";
import { textPieceLength } from "./text-piece-length.js";

const EDMONTON = "America/Edmonton";
const ONE_PIECE = 160; // what one billed piece carries
const PLAIN = /^[\x20-\x5f\x61-\x7e]*$/; // printable ASCII without the backtick

// The longest app address the texts are planned for, and a packed link's 45 characters.
const link = `https://booking.example-app.ca/b/${"D".repeat(22)}.${"m".repeat(22)}`;

describe("renderReminderText", () => {
  test("only the business, the time and the link", () => {
    expect(
      renderReminderText({
        businessName: "Summit Painting",
        startsAt: new Date("2026-10-13T15:00:00Z"),
        timezone: EDMONTON,
        bookingPageUrl: link,
      })
    ).toBe(`Summit Painting reminder: Tue Oct 13, 9:00am. Details or changes: ${link}`);
  });

  test.each([
    "Summit Painting (dev)",
    "The Latam Painters",
    "Face and Body Clinic",
    "Primo Painters",
  ])(
    "with an app address of up to 30 characters, %s's reminder is plain and one piece",
    (businessName) => {
      // The longest time a text can say: a Wednesday in September, past ten.
      const text = renderReminderText({
        businessName,
        startsAt: new Date("2026-09-30T17:45:00Z"),
        timezone: EDMONTON,
        bookingPageUrl: link,
      });

      expect(text).toMatch(PLAIN);
      expect(textPieceLength(text)).toBeLessThanOrEqual(ONE_PIECE);
    }
  );

  test("a long business name loses words from its end, as in the confirmation", () => {
    const text = renderReminderText({
      businessName: "Summit Painting and Decorating Contractors of Southern Alberta Limited",
      startsAt: new Date("2026-09-30T17:45:00Z"),
      timezone: EDMONTON,
      bookingPageUrl: link,
    });

    expect(textPieceLength(text)).toBeLessThanOrEqual(ONE_PIECE);
    expect(text).toMatch(/^Summit Painting and Decorating( \w+)* reminder: Wed Sep 30, 11:45am\. /);
    expect(text.endsWith(link)).toBe(true);
  });
});
