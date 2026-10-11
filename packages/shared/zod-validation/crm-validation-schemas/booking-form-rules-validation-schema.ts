// Shared Zod schema: what the business's booking form requires, as the owner saves it on the
// Booking form page (feature 12f): the contact rule, and whether the form asks the customer's yes
// to later texts.

import { z } from "zod";

import { contactRuleValidationSchema } from "./contact-rule-validation-schema.js";

export const bookingFormRulesValidationSchema = z
  .object({
    contactRule: contactRuleValidationSchema,
    askLaterTextsYes: z.boolean("Pick whether the form asks for the yes to later texts."),
  })
  .strict();

export type BookingFormRulesType = z.output<typeof bookingFormRulesValidationSchema>;
