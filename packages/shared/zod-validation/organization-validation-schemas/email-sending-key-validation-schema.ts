// Shared Zod schema: a business's own Resend key, made with "Sending access" only (decision 6).
// Only its shape is checked here; the backend proves it works with a test email before saving.

import { z } from "zod";

export const emailSendingKeyValidationSchema = z
  .string()
  .trim()
  .regex(/^re_[A-Za-z0-9_]{8,200}$/, "That is not a Resend key. It starts with re_.");
