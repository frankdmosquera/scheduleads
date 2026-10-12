// Shared Zod schema: a business's text choices, as the owner saves them on Settings > Texts
// (feature 12g): whether the confirmation goes, its reminders, and where a customer's reply is
// passed on. The texting number is the agency's (the setup file's), and the yes to later texts is
// the Booking form page's, so neither is here.

import { z } from "zod";

import { emailAddressValidationSchema } from "../auth-validation-schemas/email-address-validation-schema.js";
import { textableNumberValidationSchema } from "./textable-number-validation-schema.js";

export const TEXT_REMINDERS_MAX = 10;

export const textChoicesValidationSchema = z
  .object({
    confirmationOn: z.boolean("Pick whether the confirmation text goes."),
    reminderMinutesBefore: z
      .array(
        z
          .int32("Give each reminder in whole minutes.")
          .positive("A reminder goes at least a minute before."),
        "That is not a list of reminders."
      )
      .max(TEXT_REMINDERS_MAX, `At most ${TEXT_REMINDERS_MAX} reminders.`)
      .refine(
        (minutes) => new Set(minutes).size === minutes.length,
        "That reminder is there twice."
      ),
    replyPhone: textableNumberValidationSchema.nullable(),
    replyEmail: emailAddressValidationSchema.nullable(),
  })
  .strict()
  .refine((choices) => choices.replyPhone !== null || choices.replyEmail !== null, {
    message: "Choose where replies go: a phone, an email, or both.",
    path: ["replyPhone"],
  });

export type TextChoicesInputType = z.input<typeof textChoicesValidationSchema>;
export type TextChoicesType = z.output<typeof textChoicesValidationSchema>;
