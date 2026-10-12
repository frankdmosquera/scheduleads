// Shared Zod schema: which calendar week the Calendar page asks for (feature 12b): one person or
// place, and a date in the week. Both optional: the caller's own person, and this week.

import { z } from "zod";

export const scheduleWeekQueryValidationSchema = z
  .object({
    resourceId: z.string().min(1).max(64).optional(),
    weekOf: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Give the week as a date, YYYY-MM-DD.")
      .refine((date) => {
        const [year, month, day] = date.split("-").map(Number);
        const parsed = new Date(Date.UTC(year, month - 1, day));
        return parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
      }, "That date does not exist.")
      .optional(),
  })
  .strict();

export type ScheduleWeekQueryType = z.infer<typeof scheduleWeekQueryValidationSchema>;
