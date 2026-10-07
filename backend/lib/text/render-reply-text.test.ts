// A customer's reply as the business's phone gets it: who, their number, their words untouched.

import { describe, expect, test } from "vitest";

import { renderReplyText } from "./render-reply-text.js";

describe("renderReplyText", () => {
  test("a known customer is named, with their number and where to answer", () => {
    expect(renderReplyText("Jane Doe", "+14035550148", "Can we make it 8 instead?")).toBe(
      "Reply from Jane Doe, 403-555-0148: Can we make it 8 instead? (answer at 403-555-0148, not here)"
    );
  });

  test("an unknown number is shown alone", () => {
    expect(renderReplyText(null, "+14035550199", "Who is this?")).toBe(
      "Reply from 403-555-0199: Who is this? (answer at 403-555-0199, not here)"
    );
  });

  test("their words are never changed, an emoji or an accent included", () => {
    expect(renderReplyText("Zoë", "+14035550148", "On my way 👍 merci")).toBe(
      "Reply from Zoe, 403-555-0148: On my way 👍 merci (answer at 403-555-0148, not here)"
    );
  });
});
