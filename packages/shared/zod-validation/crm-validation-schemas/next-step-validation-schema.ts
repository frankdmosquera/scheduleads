// Shared Zod schema: a next step the owner owes a contact ("call back Thursday"): a few words and
// when it is due, as the owner's clock shows it. The API reads that time in the business's zone,
// or in the browser's when the business has none yet, which is the zone the page shows it in.

import { z } from "zod";

const isTimeZone = (zone: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

// "2026-02-30T09:00" would otherwise roll quietly into March.
const isRealDateTime = (local: string) => {
  const moment = new Date(`${local}:00Z`);
  return !Number.isNaN(moment.getTime()) && moment.toISOString().startsWith(local);
};

export const nextStepValidationSchema = z.object({
  what: z.string().trim().min(1, "Say what is owed.").max(200, "Keep it under 200 characters."),
  dueLocal: z // "2026-10-15T09:00"
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick when it is due.")
    .refine(isRealDateTime, "Pick when it is due."),
  browserTimeZone: z.string().max(64).refine(isTimeZone, "Your browser's time zone is not known."),
});

export type NextStepInputType = z.input<typeof nextStepValidationSchema>;
