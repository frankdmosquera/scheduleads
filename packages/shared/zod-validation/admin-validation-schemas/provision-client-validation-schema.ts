// Shared Zod schema: setting up a client, their login and their business in one go, with the
// details the business's emails need (feature 6). Its emails go through the agency's key (25a).
// The platform admin's form checks it before sending, and POST /admin/clients again.

import { z } from "zod";

import { emailAddressValidationSchema } from "../auth-validation-schemas/email-address-validation-schema.js";
import { businessEmailDetailsValidationSchema } from "../organization-validation-schemas/business-email-details-validation-schema.js";
import { businessNameValidationSchema } from "../organization-validation-schemas/business-name-validation-schema.js";

export const provisionClientValidationSchema = businessEmailDetailsValidationSchema.extend({
  businessName: businessNameValidationSchema,
  clientName: z
    .string()
    .trim()
    .min(1, "Enter the client's name.")
    .max(100, "That name is too long."),
  clientEmail: emailAddressValidationSchema,
});

export type ProvisionClientInputType = z.infer<typeof provisionClientValidationSchema>;
