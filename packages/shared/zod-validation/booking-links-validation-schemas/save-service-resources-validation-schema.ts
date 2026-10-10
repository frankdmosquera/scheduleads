// Shared Zod schema: who does a service, as the owner ticks it on Settings (feature 12d). Nobody
// ticked means anyone can do it; no place ticked means no room is needed.

import { z } from "zod";

const tickedIdsValidationSchema = (what: string) =>
  z
    .array(z.string().min(1).max(200))
    .max(500, `Tick at most 500 ${what}.`)
    .refine((ids) => new Set(ids).size === ids.length, `Tick each of the ${what} once.`);

export const saveServiceResourcesValidationSchema = z
  .object({
    peopleIds: tickedIdsValidationSchema("people"),
    placeIds: tickedIdsValidationSchema("places"),
  })
  .strict();

export type SaveServiceResourcesInputType = z.input<typeof saveServiceResourcesValidationSchema>;
export type SaveServiceResourcesType = z.output<typeof saveServiceResourcesValidationSchema>;
