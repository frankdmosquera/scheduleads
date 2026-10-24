// Shared Zod schema: the language a booking window speaks, and so the language its times are
// written in (feature 12i). Only English and Spanish.

import { z } from "zod";

export const bookingLanguageValidationSchema = z.enum(["en", "es"], "Use en or es.");

export type BookingLanguageType = z.infer<typeof bookingLanguageValidationSchema>;
