// Shared Zod schema: a business's setup file (feature 10), what the dev seed also describes its
// two businesses with. Until Settings (feature 12), a client's services, people, hours and
// questions are written in one of these and applied by `npm run client:setup`.

import { z } from "zod";

import { businessAvailabilityRuleValidationSchema } from "../availability-validation-schemas/availability-rule-validation-schema.js";
import { dateHoursValidationSchema } from "../availability-validation-schemas/date-hours-validation-schema.js";
import { weeklyHoursValidationSchema } from "../availability-validation-schemas/weekly-hours-validation-schema.js";
import { workerTextSettingsValidationSchema } from "../text-validation-schemas/worker-text-settings-validation-schema.js";

const nameValidationSchema = z.string().trim().min(1).max(200);

export const setupPersonValidationSchema = z
  .object({
    name: nameValidationSchema,
    kind: z.enum(["person", "place"]),
    weeklyHours: weeklyHoursValidationSchema.nullable().optional(), // missing = no row, the business's week
    dateHours: dateHoursValidationSchema.optional(),
    standbyDates: z.array(z.iso.date()).optional(), // at work, hidden from customers on these dates
    workerTexts: workerTextSettingsValidationSchema.optional(), // a person only; missing = no texts
  })
  .strict()
  .refine((person) => person.kind === "person" || person.workerTexts === undefined, {
    message: "A place gets no texts: only people do.",
    path: ["workerTexts"],
  });

export const setupServiceValidationSchema = z
  .object({
    name: nameValidationSchema,
    description: z.string().trim().min(1).max(500).optional(),
    durationMinutes: z.int().min(1),
    bufferBeforeMinutes: z.int().min(0).optional(),
    bufferAfterMinutes: z.int().min(0).optional(),
    slotIntervalMinutes: z.int().min(1).optional(), // minutes between start times; missing = every service length
    ticked: z.array(nameValidationSchema).optional(), // who does what, by name; missing = anyone
  })
  .strict();

export const clientSetupValidationSchema = z
  .object({
    slug: z.string().min(1), // the business, already made by the client setup screen
    personChoice: z.enum(["customer_picks", "business_assigns"]),
    questions: z.array(z.object({ label: nameValidationSchema, required: z.boolean() }).strict()),
    // The business's own hours row, without the resourceId only the database needs.
    hours: z.preprocess(
      (hours) =>
        hours !== null && typeof hours === "object" ? { resourceId: null, ...hours } : hours,
      businessAvailabilityRuleValidationSchema
    ),
    people: z.array(setupPersonValidationSchema),
    services: z.array(setupServiceValidationSchema).min(1, "A business needs a service."),
  })
  .strict()
  .refine(
    (setup) => new Set(setup.people.map((person) => person.name)).size === setup.people.length,
    { message: "The same person or place is listed twice.", path: ["people"] }
  );

export type ClientSetupInputType = z.input<typeof clientSetupValidationSchema>;
export type ClientSetupType = z.output<typeof clientSetupValidationSchema>;
export type SetupPersonType = z.output<typeof setupPersonValidationSchema>;
export type SetupServiceType = z.output<typeof setupServiceValidationSchema>;
