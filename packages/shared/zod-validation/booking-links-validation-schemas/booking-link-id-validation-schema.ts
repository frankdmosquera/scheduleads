// Shared Zod schema: a booking link's id, as it arrives in a public URL. Ids are
// randomUUID() today; letters, digits, hyphens and underscores up to 64 leave room for
// any id format without letting arbitrary text reach a query.

import { z } from "zod";

export const bookingLinkIdValidationSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "That is not a booking link id.");
