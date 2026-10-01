// Shared Zod schema: an email address, as every login stores it.

import { z } from "zod";

// Trimmed and lowercased before checking, because Better Auth lowercases emails too:
// what the user sees is exactly the address their account uses.
export const emailAddressValidationSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));
