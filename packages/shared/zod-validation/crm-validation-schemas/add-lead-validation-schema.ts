// Shared Zod schema: a lead the owner types in by hand, usually from a phone call (feature 11).
// A name, and at least a phone or an email so the business can reach them. An empty field is
// sent as "" by the form and means "not given".

import { z } from "zod";

import { emailAddressValidationSchema } from "../auth-validation-schemas/email-address-validation-schema.js";

export const addLeadValidationSchema = z
  .object({
    requestKey: z.uuid(), // one per form, so a retried save gives back the first lead
    name: z.string().trim().min(1, "Enter a name.").max(120, "That name is too long."),
    phone: z.string().trim().max(40, "That phone number is too long.").optional(),
    email: z.union([z.literal(""), emailAddressValidationSchema]).optional(),
    details: z.string().trim().max(2000, "Keep it under 2,000 characters.").optional(),
  })
  .refine((lead) => Boolean(lead.phone) || Boolean(lead.email), {
    message: "Enter a phone number or an email, so you can reach them.",
    path: ["phone"],
  });

export type AddLeadInputType = z.input<typeof addLeadValidationSchema>;
