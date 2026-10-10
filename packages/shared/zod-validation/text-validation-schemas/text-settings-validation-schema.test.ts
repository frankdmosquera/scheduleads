import { describe, expect, test } from "vitest";

import { textSettingsValidationSchema } from "./text-settings-validation-schema.js";

const summit = {
  fromNumber: "403 555 0199",
  confirmationOn: true,
  reminderMinutesBefore: [1200, 60],
  replyPhone: "(403) 555-0100",
  replyEmail: null,
  askLaterTextsYes: true,
};

const message = (changes: Record<string, unknown>) =>
  textSettingsValidationSchema.safeParse({ ...summit, ...changes }).error?.issues[0]?.message;

describe("a business's text settings", () => {
  test("its numbers are kept as Twilio texts them, its reminders as given", () => {
    expect(textSettingsValidationSchema.parse(summit)).toEqual({
      fromNumber: "+14035550199",
      confirmationOn: true,
      reminderMinutesBefore: [1200, 60],
      replyPhone: "+14035550100",
      replyEmail: null,
      askLaterTextsYes: true,
    });
  });

  test("no reminder, the confirmation off, replies only by email", () => {
    expect(
      textSettingsValidationSchema.parse({
        ...summit,
        confirmationOn: false,
        reminderMinutesBefore: [],
        replyPhone: null,
        replyEmail: " Office@Primo.com ",
      })
    ).toMatchObject({
      confirmationOn: false,
      reminderMinutesBefore: [],
      replyEmail: "office@primo.com",
    });
  });

  test("replies to a phone and an email at once", () => {
    expect(
      textSettingsValidationSchema.parse({ ...summit, replyEmail: "office@primo.com" })
    ).toMatchObject({ replyPhone: "+14035550100", replyEmail: "office@primo.com" });
  });

  test.each([
    [
      "a number that cannot be texted",
      { fromNumber: "555 0199" },
      "Use a Canadian or US number, like 403 555 0148.",
    ],
    [
      "a reply phone that cannot be texted",
      { replyPhone: "+44 20 7946 0958" },
      "Use a Canadian or US number, like 403 555 0148.",
    ],
    [
      "a reminder of no minutes",
      { reminderMinutesBefore: [0] },
      "A reminder goes at least a minute before.",
    ],
    [
      "a reminder after the start",
      { reminderMinutesBefore: [-30] },
      "A reminder goes at least a minute before.",
    ],
    [
      "a reminder in part minutes",
      { reminderMinutesBefore: [90.5] },
      "Give each reminder in whole minutes.",
    ],
    [
      "the same reminder twice",
      { reminderMinutesBefore: [60, 1200, 60] },
      "That reminder is there twice.",
    ],
    [
      "nowhere for replies",
      { replyPhone: null, replyEmail: null },
      "Choose where replies go: a phone, an email, or both.",
    ],
    [
      "replies to the texting number",
      { replyPhone: "+1 403 555 0199" },
      "Replies cannot go to the texting number itself.",
    ],
  ])("%s is refused", (_, changes, expected) => {
    expect(message(changes)).toBe(expected);
  });

  test("the confirmation must be chosen, on or off: there is no default", () => {
    const { confirmationOn: _, ...unchosen } = summit;
    expect(textSettingsValidationSchema.safeParse(unchosen).success).toBe(false);
  });

  test("whether the booking form asks for a yes to later texts must be chosen too", () => {
    const { askLaterTextsYes: _, ...unchosen } = summit;
    expect(textSettingsValidationSchema.safeParse(unchosen).success).toBe(false);
  });
});
