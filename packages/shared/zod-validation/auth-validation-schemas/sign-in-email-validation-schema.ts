// Shared Zod schema: the email step of sign-in.

import { z } from "zod";

import { emailAddressValidationSchema } from "./email-address-validation-schema.js";

export const signInEmailValidationSchema = z.object({
  email: emailAddressValidationSchema,
});
