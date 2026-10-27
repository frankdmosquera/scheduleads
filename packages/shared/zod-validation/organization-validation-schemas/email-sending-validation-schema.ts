// Shared Zod schema: the owner's "Email sending" card (feature 25a): the address the business's
// emails come from and where its booking notifications go, both optional. Left empty, the sender
// is picked for it and the notices go to the owner's login email.

import { z } from "zod";

import { emailAddressValidationSchema } from "../auth-validation-schemas/email-address-validation-schema.js";

const empty = z.literal("");

export const emailSendingValidationSchema = z.object({
  senderEmail: z.union([empty, emailAddressValidationSchema]),
  notifyEmail: z.union([empty, emailAddressValidationSchema]),
});

export type EmailSendingInputType = z.infer<typeof emailSendingValidationSchema>;
