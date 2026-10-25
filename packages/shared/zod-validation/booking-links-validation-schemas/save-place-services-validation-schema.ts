// Shared Zod schema: the services that need a place, as the owner ticks them on its card on the
// Places page (feature 12k): all at once. None ticked: no service waits for it to be free.

import { z } from "zod";

export const savePlaceServicesValidationSchema = z
  .object({
    serviceIds: z
      .array(z.string().min(1).max(200))
      .max(500, "Tick at most 500 services.")
      .refine((ids) => new Set(ids).size === ids.length, "Tick each of the services once."),
  })
  .strict();

export type SavePlaceServicesInputType = z.input<typeof savePlaceServicesValidationSchema>;
export type SavePlaceServicesType = z.output<typeof savePlaceServicesValidationSchema>;
