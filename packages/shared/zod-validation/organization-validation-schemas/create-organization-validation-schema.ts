// Shared Zod schema: naming a new business.

import { z } from "zod";

export const createOrganizationValidationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter the name of your business.")
    .max(80, "That name is too long."),
});
