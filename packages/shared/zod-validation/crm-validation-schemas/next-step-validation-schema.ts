// Shared Zod schema: a next step the owner owes a contact ("call back Thursday"): a few words and
// when it is due.

import { z } from "zod";

export const nextStepValidationSchema = z.object({
  what: z.string().trim().min(1, "Say what is owed.").max(200, "Keep it under 200 characters."),
  dueAt: z.iso.datetime({ offset: true, message: "Pick when it is due." }),
});

export type NextStepInputType = z.input<typeof nextStepValidationSchema>;
