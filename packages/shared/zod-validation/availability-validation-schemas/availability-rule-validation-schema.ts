// Shared Zod schema: one row of bookable hours, the business's or one person's. Mirrors the
// database check, so a bad row gets a readable message instead of a constraint name.

import { z } from "zod";

import { dateHoursValidationSchema } from "./date-hours-validation-schema.js";
import { weeklyHoursValidationSchema } from "./weekly-hours-validation-schema.js";

function isRealTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }); // throws on an unknown zone
    return true;
  } catch {
    return false;
  }
}

// The business's row. Everything set once per business lives here and only here.
export const businessAvailabilityRuleValidationSchema = z
  .object({
    resourceId: z.null(),
    weeklyHours: weeklyHoursValidationSchema,
    dateHours: dateHoursValidationSchema.default([]),
    timezone: z.string().refine(isRealTimezone, { message: "That is not a time zone." }),
    minimumNoticeMinutes: z.int().min(0),
    horizonDays: z.int().min(1).max(365, "Customers can book at most a year ahead."),
    closedDates: z.array(z.iso.date()).refine((dates) => new Set(dates).size === dates.length, {
      message: "The same closed date is listed twice.",
    }),
    holidayCountry: z
      .string()
      .regex(/^[A-Z]{2}$/, "Use the two-letter country code, like CA.")
      .nullable()
      .default(null),
    holidayRegion: z
      .string()
      .regex(/^[A-Z0-9]{1,3}$/, "Use the province code, like AB.")
      .nullable()
      .default(null),
    // The holiday names the owner picked to close; empty = none, which is the default.
    closedHolidays: z
      .array(z.string().min(1))
      .refine((names) => new Set(names).size === names.length, {
        message: "The same holiday is picked twice.",
      })
      .default([]),
  })
  .strict()
  .refine((rule) => rule.holidayRegion === null || rule.holidayCountry !== null, {
    message: "A province needs its country.",
    path: ["holidayRegion"],
  })
  .refine((rule) => rule.closedHolidays.length === 0 || rule.holidayCountry !== null, {
    message: "Picked holidays need the country they come from.",
    path: ["closedHolidays"],
  });

// A person's row: only their own week (null = follow the business's) and their one-off
// dates. strict() refuses a time zone or notice here, like the database does.
export const personAvailabilityRuleValidationSchema = z
  .object({
    resourceId: z.string().min(1),
    weeklyHours: weeklyHoursValidationSchema.nullable().default(null),
    dateHours: dateHoursValidationSchema.default([]),
  })
  .strict();

export const availabilityRuleValidationSchema = z.union([
  businessAvailabilityRuleValidationSchema,
  personAvailabilityRuleValidationSchema,
]);

export type BusinessAvailabilityRuleType = z.infer<typeof businessAvailabilityRuleValidationSchema>;
export type PersonAvailabilityRuleType = z.infer<typeof personAvailabilityRuleValidationSchema>;
export type AvailabilityRuleType = z.infer<typeof availabilityRuleValidationSchema>;
