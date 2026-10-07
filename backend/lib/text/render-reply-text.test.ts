// A customer's reply as the business's phone gets it: who, their number, their words untouched.

import { describe, expect, test } from "vitest";

import { renderReplyText } from "./render-reply-text.js";

const jane = { senderName: "Jane Doe", number: "+14035550148", hasPicture: false };

describe("renderReplyText", () => {
  test("a known customer is named, with their number and where to answer", () => {
    expect(renderReplyText({ ...jane, words: "Can we make it 8 instead?" })).toBe(
      "Reply from Jane Doe, 403-555-0148: Can we make it 8 instead? (answer at 403-555-0148, not here)"
    );
  });

  test("an unknown number is shown alone", () => {
    expect(
      renderReplyText({ ...jane, senderName: null, number: "+14035550199", words: "Who is this?" })
    ).toBe("Reply from 403-555-0199: Who is this? (answer at 403-555-0199, not here)");
  });

  test("their words are never changed, an emoji or an accent included", () => {
    expect(renderReplyText({ ...jane, senderName: "Zoë", words: "On my way 👍 merci" })).toBe(
      "Reply from Zoe, 403-555-0148: On my way 👍 merci (answer at 403-555-0148, not here)"
    );
  });

  test.each(["李明", "Ольга"])("a name with no plain letters, %s, is shown by number", (name) => {
    expect(renderReplyText({ ...jane, senderName: name, words: "Hello" })).toBe(
      "Reply from 403-555-0148: Hello (answer at 403-555-0148, not here)"
    );
  });

  test("a picture is said, not passed on", () => {
    expect(renderReplyText({ ...jane, words: "The wall", hasPicture: true })).toBe(
      "Reply from Jane Doe, 403-555-0148: The wall [picture not shown] (answer at 403-555-0148, not here)"
    );
    expect(renderReplyText({ ...jane, words: "", hasPicture: true })).toBe(
      "Reply from Jane Doe, 403-555-0148: [picture not shown] (answer at 403-555-0148, not here)"
    );
  });

  test("words too long for one text are cut to Twilio's 1600, never inside a character", () => {
    const text = renderReplyText({ ...jane, words: "👍".repeat(1000) });

    expect(text.length).toBeLessThanOrEqual(1600);
    expect(text).toMatch(/^Reply from Jane Doe, 403-555-0148: (👍)+\.\.\. \(answer at/);
  });

  test("a long reply with a picture keeps the picture note when its words are cut", () => {
    const text = renderReplyText({ ...jane, words: "a".repeat(1560), hasPicture: true });

    expect(text.length).toBeLessThanOrEqual(1600);
    expect(text).toMatch(/a\.\.\. \[picture not shown\] \(answer at 403-555-0148, not here\)$/);
  });
});
