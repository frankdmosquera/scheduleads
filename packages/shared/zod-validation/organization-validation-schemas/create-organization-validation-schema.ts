// Shared Zod schema: naming a new business.

import { z } from "zod";

// A business's name, wherever one is typed: the create form and setting up a client.
export const businessNameValidationSchema = z
  .string()
  .trim()
  .min(2, "Enter the name of your business.")
  .max(80, "That name is too long.");

export const createOrganizationValidationSchema = z.object({
  name: businessNameValidationSchema,
});
