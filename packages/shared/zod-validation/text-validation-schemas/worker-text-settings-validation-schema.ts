// Shared Zod schema: one person's worker-text settings (feature 8c, decision 1), as client setup
// saves them and Settings (feature 12) will. Every switch must be given: none is on by default.
// Whether the phone is some business's texting number needs the database, so the saving code and
// the sending job check that (decision 6).

import { z } from "zod";

import { textableNumberValidationSchema } from "./textable-number-validation-schema.js";

export const workerTextSettingsValidationSchema = z.object({
  phone: textableNumberValidationSchema,
  addedOn: z.boolean(),
  movedOn: z.boolean(),
  removedOn: z.boolean(),
});

export type WorkerTextSettingsInputType = z.input<typeof workerTextSettingsValidationSchema>;
export type WorkerTextSettingsType = z.output<typeof workerTextSettingsValidationSchema>;
