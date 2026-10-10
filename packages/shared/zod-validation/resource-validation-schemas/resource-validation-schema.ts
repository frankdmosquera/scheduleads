// Shared Zod schemas: a person or a place as the owner adds or changes it on Settings (feature 12d).
// The kind is picked once, when it is added (decision 4); turning off is the only way to remove one.

import { z } from "zod";

const resourceNameValidationSchema = z
  .string()
  .trim()
  .min(1, "Give them a name.")
  .max(200, "That name is too long.");

export const addResourceValidationSchema = z
  .object({
    name: resourceNameValidationSchema,
    kind: z.enum(["person", "place"], { error: "Pick a person or a place." }),
  })
  .strict();

export const saveResourceValidationSchema = z
  .object({
    name: resourceNameValidationSchema,
    active: z.boolean(), // false: off, no longer offered; their bookings stay
  })
  .strict();

export type AddResourceInputType = z.input<typeof addResourceValidationSchema>;
export type AddResourceType = z.output<typeof addResourceValidationSchema>;
export type SaveResourceInputType = z.input<typeof saveResourceValidationSchema>;
export type SaveResourceType = z.output<typeof saveResourceValidationSchema>;
