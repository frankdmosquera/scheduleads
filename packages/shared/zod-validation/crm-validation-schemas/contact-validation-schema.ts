// Shared Zod schema: a contact, a person a business deals with. Email and phone are both
// optional: a phone booking (feature 5) may have no email. Which a form requires is its own call.

import { z } from "zod";

import { emailAddressValidationSchema } from "../auth-validation-schemas/email-address-validation-schema.js";

export const contactValidationSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120, "That name is too long."),
  email: emailAddressValidationSchema.optional(),
  phone: z
    .string()
    .trim()
    .min(1, "Enter a phone number.")
    .max(40, "That phone number is too long.")
    .optional(),
});

export type ContactInputType = z.input<typeof contactValidationSchema>;
