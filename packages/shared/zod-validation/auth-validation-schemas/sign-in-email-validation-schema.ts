// Shared Zod schema: the email step of sign-in.

import { z } from "zod";

// Trimmed and lowercased before checking, because Better Auth lowercases emails too:
// what the user sees is exactly the address their account uses.
export const emailAddressValidationSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

export const signInEmailValidationSchema = z.object({
  email: emailAddressValidationSchema,
});
