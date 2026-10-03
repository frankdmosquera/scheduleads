// Shared Zod schema: setting up a client, their login and their business in one go, with the
// details the business's emails need and, for a client the agency set up in Resend itself, the
// business's own key (feature 6, decision 6). The platform admin's form checks it before
// sending, and POST /admin/clients again.

import { z } from "zod";

import { emailAddressValidationSchema } from "../auth-validation-schemas/email-address-validation-schema.js";
import { businessEmailDetailsValidationSchema } from "../organization-validation-schemas/business-email-details-validation-schema.js";
import { businessNameValidationSchema } from "../organization-validation-schemas/business-name-validation-schema.js";
import { emailSendingKeyValidationSchema } from "../organization-validation-schemas/email-sending-key-validation-schema.js";

export const provisionClientValidationSchema = businessEmailDetailsValidationSchema
  .extend({
    businessName: businessNameValidationSchema,
    clientName: z
      .string()
      .trim()
      .min(1, "Enter the client's name.")
      .max(100, "That name is too long."),
    clientEmail: emailAddressValidationSchema,
    emailSendingKey: z.union([z.literal(""), emailSendingKeyValidationSchema]).optional(),
  })
  // The key is tested by sending from the business's address, so it needs one.
  .refine((input) => !input.emailSendingKey || Boolean(input.senderEmail), {
    message: "Enter the address emails come from, so the key can be tested.",
    path: ["senderEmail"],
  });

export type ProvisionClientInputType = z.infer<typeof provisionClientValidationSchema>;
