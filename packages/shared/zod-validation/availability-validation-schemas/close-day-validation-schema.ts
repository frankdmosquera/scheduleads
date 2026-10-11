// Shared Zod schema: closing one day for everyone on the Days off page (feature 12e).

import { z } from "zod";

export const closeDayValidationSchema = z
  .object({
    date: z.iso.date({ error: "Use a real date, like 2026-11-02." }), // YYYY-MM-DD, the business's clock
  })
  .strict();

export type CloseDayType = z.infer<typeof closeDayValidationSchema>;
