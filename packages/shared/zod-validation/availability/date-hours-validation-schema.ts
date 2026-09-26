// Shared Zod schema: one-off dates, hours on a single date without touching the week.
// A one-off date replaces that date's hours, and opens it if it is closed or a holiday.

import { z } from "zod";

import { dayWindowsValidationSchema } from "./weekly-hours-validation-schema.js";

export const dateHoursValidationSchema = z
  .array(
    z
      .object({
        date: z.iso.date(), // YYYY-MM-DD, a real calendar date
        windows: dayWindowsValidationSchema.min(1, "A one-off date needs at least one window."),
      })
      .strict()
  )
  .refine((entries) => new Set(entries.map((entry) => entry.date)).size === entries.length, {
    message: "The same date is listed twice.",
  });

export type DateHoursType = z.infer<typeof dateHoursValidationSchema>;
