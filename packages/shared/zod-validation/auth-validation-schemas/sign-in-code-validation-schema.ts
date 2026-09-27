// Shared Zod schema: the login-code step of sign-in.

import { z } from "zod";

// Better Auth's default code length. If otpLength is ever set in auth-server.ts,
// change this in the same edit.
export const OTP_LENGTH = 6;

export const signInCodeValidationSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(
      new RegExp(`^[0-9]{${OTP_LENGTH}}$`),
      `Enter the ${OTP_LENGTH} digit code from your email.`
    ),
});
