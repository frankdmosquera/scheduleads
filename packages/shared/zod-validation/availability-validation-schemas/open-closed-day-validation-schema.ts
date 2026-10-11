// Shared Zod schema: opening a closed day again on the Days off page (feature 12e), for one person
// or for everyone.

import { z } from "zod";

export const openClosedDayValidationSchema = z
  .object({
    date: z.iso.date({ error: "Use a real date, like 2026-11-02." }), // YYYY-MM-DD, the business's clock
    personId: z.string().min(1).nullable(), // null = for everyone
  })
  .strict();

export type OpenClosedDayType = z.infer<typeof openClosedDayValidationSchema>;
