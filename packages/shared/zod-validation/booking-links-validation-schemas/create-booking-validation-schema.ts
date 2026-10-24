// Shared Zod schema: what a booking form sends when the customer presses Book. The business comes
// from the address, never from here, and the time must still be one the times route offers.

import { z } from "zod";

import { textablePhoneNumber } from "../../helpers/textable-phone-number.js";
import { contactValidationSchema } from "../crm-validation-schemas/contact-validation-schema.js";
import { bookingLanguageValidationSchema } from "./booking-language-validation-schema.js";
import { bookingLinkIdValidationSchema } from "./booking-link-id-validation-schema.js";

// The same rule as a booking link id: any id format fits, no arbitrary text reaches a query.
const idOf = (message: string) => z.string(message).regex(/^[A-Za-z0-9_-]{1,64}$/, message);

export const createBookingValidationSchema = z
  .object({
    bookingLinkId: bookingLinkIdValidationSchema,
    startsAt: z.iso.datetime({ offset: true, error: "Pick one of the times offered." }), // Z or an offset
    personId: idOf("That is not a person id.").optional(), // left out = any available
    requestKey: idOf("That is not a booking form key.").optional(), // one per form (decision 7)
    // Which of email and phone must be there is the business's own rule, checked by the API and the
    // booking window with missingContact (feature 12f).
    customer: contactValidationSchema,
    // Required by the API only for a service that requires it; kept when optional, never otherwise.
    location: z
      .string("Enter the address.")
      .trim()
      .min(1, "Enter the address.")
      .max(300, "That address is too long.")
      .optional(),
    details: z.string().trim().max(2000, "Keep it to 2000 characters.").optional(),
    // The business's own questions (feature 9, decision 5), checked against its questions by the API:
    // every question the form showed, with its words as shown, a blank answer included.
    answers: z
      .array(
        z.object({
          questionId: idOf("That is not a question id."),
          question: z
            .string("That is not a question.")
            .trim()
            .min(1, "That is not a question.")
            .max(200, "That is not a question."),
          answer: z
            .string("Answer in words.")
            .trim()
            .max(500, "Keep each answer to 500 characters."),
        }),
        "That is not a list of answers."
      )
      .max(20, "That is too many answers.")
      .optional(),
    // Her yes to later texts (decision 13), only from a business that asks; left out = no yes.
    laterTextsYes: z.boolean("That is not a yes or a no.").optional(),
    // The language the window spoke (feature 12i); left out = English.
    language: bookingLanguageValidationSchema.optional(),
  })
  // A yes belongs to a number that can get texts: without one it proves nothing.
  .refine(
    (form) => form.laterTextsYes !== true || textablePhoneNumber(form.customer.phone) !== null,
    {
      error: "Enter a phone that can get texts.",
      path: ["customer", "phone"],
    }
  );
