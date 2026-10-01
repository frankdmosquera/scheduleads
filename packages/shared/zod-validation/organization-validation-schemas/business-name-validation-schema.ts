// Shared Zod schema: a business's name, wherever one is typed (setting up a client today).

import { z } from "zod";

export const businessNameValidationSchema = z
  .string()
  .trim()
  .min(2, "Enter the business's name.")
  .max(80, "That name is too long.");
