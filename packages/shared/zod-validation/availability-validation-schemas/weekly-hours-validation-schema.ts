// Shared Zod schema: a week of bookable hours, the windows customers can book online.
// Minutes count from midnight in the business's time zone, so 570 is 9:30.

import { z } from "zod";

const MINUTES_IN_A_DAY = 1440;

export const timeWindowValidationSchema = z
  .object({
    startMinute: z.int().min(0).max(MINUTES_IN_A_DAY),
    endMinute: z.int().min(0).max(MINUTES_IN_A_DAY),
  })
  .strict()
  .refine((window) => window.endMinute > window.startMinute, {
    message: "A window has to end after it starts.",
  });

// A day's windows, in any order. Touching is fine (9-12 then 12-5); overlapping is not,
// because nobody could say which window a 11:00 booking belongs to.
export const dayWindowsValidationSchema = z.array(timeWindowValidationSchema).refine(
  (windows) => {
    const sorted = [...windows].sort((a, b) => a.startMinute - b.startMinute);
    return sorted.every(
      (window, index) => index === 0 || window.startMinute >= sorted[index - 1].endMinute
    );
  },
  { message: "Two windows on the same day overlap." }
);

// A missing or empty day is closed. Unknown keys are refused, so a typo like "tues"
// fails loudly instead of silently closing Tuesday.
export const weeklyHoursValidationSchema = z
  .object({
    mon: dayWindowsValidationSchema.optional(),
    tue: dayWindowsValidationSchema.optional(),
    wed: dayWindowsValidationSchema.optional(),
    thu: dayWindowsValidationSchema.optional(),
    fri: dayWindowsValidationSchema.optional(),
    sat: dayWindowsValidationSchema.optional(),
    sun: dayWindowsValidationSchema.optional(),
  })
  .strict();

export type TimeWindowType = z.infer<typeof timeWindowValidationSchema>;
export type WeeklyHoursType = z.infer<typeof weeklyHoursValidationSchema>;
