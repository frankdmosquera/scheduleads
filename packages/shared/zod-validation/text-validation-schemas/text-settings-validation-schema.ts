// Shared Zod schema: a business's text settings (feature 8b, decision 2), as client setup saves
// them and Settings (feature 12) will. The numbers are stored as Twilio texts them, "+14035550148".

import { z } from "zod";

import { emailAddressValidationSchema } from "../auth-validation-schemas/email-address-validation-schema.js";
import { textableNumberValidationSchema } from "./textable-number-validation-schema.js";

export const textSettingsValidationSchema = z
  .object({
    fromNumber: textableNumberValidationSchema,
    confirmationOn: z.boolean(),
    reminderMinutesBefore: z
      .array(
        z
          .int32("Give each reminder in whole minutes.")
          .positive("A reminder goes at least a minute before.")
      )
      .refine(
        (minutes) => new Set(minutes).size === minutes.length,
        "That reminder is there twice."
      ),
    replyPhone: textableNumberValidationSchema.nullable(),
    replyEmail: emailAddressValidationSchema.nullable(),
    askLaterTextsYes: z.boolean(), // the booking form's box (feature 9, decision 13)
  })
  .refine((settings) => settings.replyPhone !== null || settings.replyEmail !== null, {
    message: "Choose where replies go: a phone, an email, or both.",
    path: ["replyPhone"],
  })
  .refine((settings) => settings.replyPhone !== settings.fromNumber, {
    message: "Replies cannot go to the texting number itself.",
    path: ["replyPhone"],
  });

export type TextSettingsInputType = z.input<typeof textSettingsValidationSchema>;
export type TextSettingsType = z.output<typeof textSettingsValidationSchema>;
