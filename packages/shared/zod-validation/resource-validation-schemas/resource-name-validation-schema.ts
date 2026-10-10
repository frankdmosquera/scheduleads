// Shared Zod schema: a person's or a place's name, as both Settings forms check it (feature 12d).

import { z } from "zod";

export const resourceNameValidationSchema = z
  .string()
  .trim()
  .min(1, "Give them a name.")
  .max(200, "That name is too long.");
