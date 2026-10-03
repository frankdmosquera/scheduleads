// Shared Zod schema: the owner's "Email sending" card (feature 6, decision 9): where the
// business's emails come from, where its booking notifications go, and optionally a new key
// for its own Resend. Left empty, the key already saved stays.

import { z } from "zod";

import { emailAddressValidationSchema } from "../auth-validation-schemas/email-address-validation-schema.js";
import { emailSendingKeyValidationSchema } from "./email-sending-key-validation-schema.js";

export const emailSendingValidationSchema = z.object({
  senderEmail: emailAddressValidationSchema,
  notifyEmail: emailAddressValidationSchema,
  key: z.union([z.literal(""), emailSendingKeyValidationSchema]).optional(),
});

export type EmailSendingInputType = z.infer<typeof emailSendingValidationSchema>;
