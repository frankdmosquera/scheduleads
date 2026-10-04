// Shared Zod schema: what a customer's booking page sends to move the booking (feature 7b). The
// booking comes from the signed link, never from here, and the time must still be one the
// booking's own times route offers.

import { z } from "zod";

export const moveBookingValidationSchema = z.object({
  startsAt: z.iso.datetime({ offset: true, error: "Pick one of the times offered." }), // Z or an offset
  // Null or left out = any available. The same rule as every id: no arbitrary text reaches a query.
  personId: z
    .string("That is not a person id.")
    .regex(/^[A-Za-z0-9_-]{1,64}$/, "That is not a person id.")
    .nullable()
    .optional(),
});
