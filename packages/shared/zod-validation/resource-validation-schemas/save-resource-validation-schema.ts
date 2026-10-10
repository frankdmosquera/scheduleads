// Shared Zod schema: a person or a place as the owner changes it on Settings (feature 12d). Turning
// off is the only way to remove one (decision 3); a person also has an optional work email.

import { z } from "zod";

import { resourceNameValidationSchema } from "./resource-name-validation-schema.js";

// A person's work email: empty or null clears it. Its domain is checked against the business's
// sending address on the server, which knows it.
const workEmailValidationSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "That address is too long.")
  .nullable()
  .transform((email) => email || null)
  .pipe(z.email({ error: "Enter an email address, like pedro@example.com." }).nullable());

export const saveResourceValidationSchema = z
  .object({
    name: resourceNameValidationSchema,
    active: z.boolean(), // false: off, no longer offered; their bookings stay
    workEmail: workEmailValidationSchema.optional(), // left out: unchanged; a place sends none
  })
  .strict();

export type SaveResourceInputType = z.input<typeof saveResourceValidationSchema>;
export type SaveResourceType = z.output<typeof saveResourceValidationSchema>;
