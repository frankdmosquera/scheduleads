// Shared Zod schema: a person or a place as the owner adds it on Settings (feature 12d). The kind
// is picked once, here (decision 4).

import { z } from "zod";

import { resourceNameValidationSchema } from "./resource-name-validation-schema.js";

export const addResourceValidationSchema = z
  .object({
    name: resourceNameValidationSchema,
    kind: z.enum(["person", "place"], { error: "Pick a person or a place." }),
  })
  .strict();

export type AddResourceInputType = z.input<typeof addResourceValidationSchema>;
export type AddResourceType = z.output<typeof addResourceValidationSchema>;
