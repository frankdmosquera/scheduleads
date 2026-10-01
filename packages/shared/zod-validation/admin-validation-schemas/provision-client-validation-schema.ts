// Shared Zod schema: setting up a client, their login and their business in one go.
// The platform admin's form checks it before sending, and POST /admin/clients again.

import { z } from "zod";

import { emailAddressValidationSchema } from "../auth-validation-schemas/sign-in-email-validation-schema.js";
import { businessNameValidationSchema } from "../organization-validation-schemas/create-organization-validation-schema.js";

export const provisionClientValidationSchema = z.object({
  businessName: businessNameValidationSchema,
  clientName: z
    .string()
    .trim()
    .min(1, "Enter the client's name.")
    .max(100, "That name is too long."),
  clientEmail: emailAddressValidationSchema,
});

export type ProvisionClientInputType = z.infer<typeof provisionClientValidationSchema>;
