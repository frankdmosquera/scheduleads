// Shared Zod schema: the question a booking widget asks for a service's free times. Dates are the
// business's calendar dates, both ends included; no person means "any available".

import { z } from "zod";

const DAY_MS = 86_400_000;
const MOST_DATES = 31; // one Google read per person covers the whole range

const datesAsked = (from: string, to: string) =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS + 1;

export const freeTimesQueryValidationSchema = z
  .object({
    from: z.iso.date("Use a real date, YYYY-MM-DD."),
    to: z.iso.date("Use a real date, YYYY-MM-DD."),
    // The same rule as a booking link id: any id format fits, no arbitrary text reaches a query.
    person: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,64}$/, "That is not a person id.")
      .optional(),
  })
  .refine((query) => query.from <= query.to, {
    message: "The last date comes before the first.",
    path: ["to"],
  })
  .refine((query) => query.from > query.to || datesAsked(query.from, query.to) <= MOST_DATES, {
    message: `Ask for ${MOST_DATES} dates at most.`,
    path: ["to"],
  });

export type FreeTimesQueryType = z.infer<typeof freeTimesQueryValidationSchema>;
