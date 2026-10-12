// Shared Zod schema: one person's worker texts as the owner saves them on People (feature 12g): on,
// with a phone and every switch given (none is on by default), or null to turn them off.

import { z } from "zod";

import { workerTextSettingsValidationSchema } from "./worker-text-settings-validation-schema.js";

export const saveWorkerTextsValidationSchema = z
  .object({ texts: workerTextSettingsValidationSchema.strict().nullable() })
  .strict();

export type SaveWorkerTextsInputType = z.input<typeof saveWorkerTextsValidationSchema>;
export type SaveWorkerTextsType = z.output<typeof saveWorkerTextsValidationSchema>;
