// Shared Zod schema: a booking link's id, as it arrives in a public URL. Roomier than a
// UUID, so any id format fits, but no arbitrary text reaches a query.

import { z } from "zod";

export const bookingLinkIdValidationSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "That is not a booking link id.");
