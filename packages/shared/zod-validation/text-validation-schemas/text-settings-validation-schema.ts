// Shared Zod schema: a business's whole text settings (feature 8b, decision 2), as a setup file
// gives them: the texting number, the agency's, with the business's first text choices. The
// numbers are stored as Twilio texts them, "+14035550148".

import { z } from "zod";

import { textChoicesValidationSchema } from "./text-choices-validation-schema.js";
import { textableNumberValidationSchema } from "./textable-number-validation-schema.js";

export const textSettingsValidationSchema = z
  .object({
    fromNumber: textableNumberValidationSchema,
    ...textChoicesValidationSchema.shape,
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
