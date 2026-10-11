// Shared Zod schema: the owner cancelling bookings from the dashboard (feature 12e), one or all of
// a list at once.

import { z } from "zod";

export const cancelBookingsValidationSchema = z
  .object({
    bookingIds: z
      .array(
        z
          .string("That is not a booking id.") // the same rule as every id from the dashboard
          .regex(/^[A-Za-z0-9_-]{1,64}$/, "That is not a booking id.")
      )
      .min(1, "Pick a booking to cancel.")
      .max(100, "Cancel at most 100 bookings at once.")
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "The same booking is listed twice.",
      }),
  })
  .strict();

export type CancelBookingsType = z.infer<typeof cancelBookingsValidationSchema>;
