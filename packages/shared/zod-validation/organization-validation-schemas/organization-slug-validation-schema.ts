// Shared Zod schema: a business's web address (slug), as it arrives in a public URL.
// Loose on purpose: toSlug makes lowercase letters, digits and hyphens, up to 48, and a
// real business must never be refused by a rule stricter than the one that made its slug.

import { z } from "zod";

export const organizationSlugValidationSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,47}$/, "That is not a business address.");
