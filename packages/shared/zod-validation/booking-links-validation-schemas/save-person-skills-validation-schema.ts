// Shared Zod schema: what a person can do, as the owner ticks it on their card (feature 12k): the
// services, all at once. None ticked: they can do nothing customers book.

import { z } from "zod";

export const savePersonSkillsValidationSchema = z
  .object({
    serviceIds: z
      .array(z.string().min(1).max(200))
      .max(500, "Tick at most 500 services.")
      .refine((ids) => new Set(ids).size === ids.length, "Tick each of the services once."),
  })
  .strict();

export type SavePersonSkillsInputType = z.input<typeof savePersonSkillsValidationSchema>;
export type SavePersonSkillsType = z.output<typeof savePersonSkillsValidationSchema>;
