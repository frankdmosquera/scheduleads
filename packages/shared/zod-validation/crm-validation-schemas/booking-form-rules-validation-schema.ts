// Shared Zod schema: what the business's booking form requires, as the owner saves it on the
// Booking form page (feature 12f): the contact rule, and whether the form asks the customer's yes
// to later texts. That one is left out when the page did not show it, and then left as it is. And
// the business's language (feature 12i): its owner's emails, and a booking that came with none.

import { z } from "zod";

import { bookingLanguageValidationSchema } from "../booking-links-validation-schemas/booking-language-validation-schema.js";
import { contactRuleValidationSchema } from "./contact-rule-validation-schema.js";

// The project box's own words, as a business writes them; an empty box is null, the window's own.
export const detailsLabelValidationSchema = z
  .string()
  .trim()
  .max(80, "Keep it to 80 characters.")
  .nullable()
  .transform((label) => label || null);

export const bookingFormRulesValidationSchema = z
  .object({
    contactRule: contactRuleValidationSchema,
    askLaterTextsYes: z
      .boolean("Pick whether the form asks for the yes to later texts.")
      .optional(),
    language: bookingLanguageValidationSchema.optional(), // left out: left as it is
    // The project box (feature 13): its words, empty for the window's own, and whether it must be
    // filled. Left out: left as it is.
    detailsLabel: detailsLabelValidationSchema.optional(),
    detailsRequired: z.boolean("Pick whether the box must be filled.").optional(),
  })
  .strict();

export type BookingFormRulesType = z.output<typeof bookingFormRulesValidationSchema>;
