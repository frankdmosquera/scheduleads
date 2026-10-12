import { describe, expect, test } from "vitest";

import { textChoicesValidationSchema } from "./text-choices-validation-schema.js";

const choices = {
  confirmationOn: false,
  reminderMinutesBefore: [1200, 120],
  replyPhone: null,
  replyEmail: "office@example.com",
};
const message = (changes: Record<string, unknown>) =>
  textChoicesValidationSchema.safeParse({ ...choices, ...changes }).error?.issues[0]?.message;

describe("a business's text choices, as the owner saves them", () => {
  test("are kept as given, a reply phone as Twilio texts it", () => {
    expect(textChoicesValidationSchema.parse({ ...choices, replyPhone: "(403) 555-0100" })).toEqual(
      { ...choices, replyPhone: "+14035550100" }
    );
  });

  // A page and a setup file store the same list, so a run of the same file finds no difference.
  test("keeps the reminders the earliest first, however given", () => {
    expect(
      textChoicesValidationSchema.parse({ ...choices, reminderMinutesBefore: [60, 1440, 120] })
        .reminderMinutesBefore
    ).toEqual([1440, 120, 60]);
  });

  test.each([
    [
      "no reply destination",
      { replyEmail: null },
      "Choose where replies go: a phone, an email, or both.",
    ],
    ["a reminder twice", { reminderMinutesBefore: [60, 60] }, "That reminder is there twice."],
    [
      "more than 10 reminders",
      { reminderMinutesBefore: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
      "At most 10 reminders.",
    ],
  ])("refuses %s", (_name, changes, expected) => {
    expect(message(changes)).toBe(expected);
  });

  // The texting number is the agency's, given in the setup file: the owner's save cannot carry it.
  test("refuses a texting number", () => {
    expect(
      textChoicesValidationSchema.safeParse({ ...choices, fromNumber: "403 555 0199" }).success
    ).toBe(false);
  });
});
