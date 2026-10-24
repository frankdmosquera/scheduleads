// Shared Zod schema: a login's own pick of the dashboard's language, sent to PUT /me/language
// (feature 12j). Only English and Spanish.

import { z } from "zod";

export const dashboardLanguageValidationSchema = z.object({
  language: z.enum(["en", "es"], "Use en or es."),
});
