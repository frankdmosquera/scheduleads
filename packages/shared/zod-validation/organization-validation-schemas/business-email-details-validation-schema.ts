// Shared Zod schema: the business details its emails need (feature 6): the address they come
// from, where its booking notifications go, and the phone, website and colour the customer
// sees. Each may be left empty ("") on a form; the backend stores empty as nothing.

import { z } from "zod";

import { emailAddressValidationSchema } from "../auth-validation-schemas/email-address-validation-schema.js";

const empty = z.literal("");

export const businessEmailDetailsValidationSchema = z.object({
  senderEmail: z.union([empty, emailAddressValidationSchema]).optional(),
  notifyEmail: z.union([empty, emailAddressValidationSchema]).optional(),
  phone: z
    .union([
      empty,
      z
        .string()
        .trim()
        .min(1, "Enter a phone number, or leave it empty.")
        .max(40, "That phone number is too long."),
    ])
    .optional(),
  website: z
    .union([
      empty,
      z
        .string()
        .trim()
        .max(200, "That website address is too long.")
        .regex(/^https:\/\/[^\s/$.?#][^\s]*$/i, "Use the full website address, starting https://"),
    ])
    .optional(),
  // Hex, not a token: email clients ignore CSS variables (Primo's template pattern).
  brandColor: z
    .union([
      empty,
      z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^#[0-9a-f]{6}$/, "Use a colour like #1d4ed8."),
    ])
    .optional(),
});

export type BusinessEmailDetailsInputType = z.infer<typeof businessEmailDetailsValidationSchema>;
