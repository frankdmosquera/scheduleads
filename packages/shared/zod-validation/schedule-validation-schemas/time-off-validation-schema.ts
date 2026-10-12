// Shared Zod schema: time off the owner marks on the Calendar page (feature 12b), a person or a
// place off from one clock time to another, and what happens to each booking in its way: cancelled,
// or moved to a new start with the same person or another. Times are the business's own clock, a
// date and a minute of the day; the API turns them into moments in its zone.

import { z } from "zod";

const idOf = (message: string) => z.string(message).regex(/^[A-Za-z0-9_-]{1,64}$/, message);

const dateOf = z
  .string("Pick a day.")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a day.")
  .refine((date) => {
    const [year, month, day] = date.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  }, "That day does not exist.");

// A clock time on a day; 1440 is the end of the day, for time off that runs to midnight.
const clockOf = z
  .object({
    date: dateOf,
    minute: z.int("Pick a time.").min(0, "Pick a time.").max(1440, "Pick a time."),
  })
  .strict();

export const timeOffValidationSchema = z
  .object({
    resourceId: idOf("Pick who is off."),
    from: clockOf,
    to: clockOf,
    bookings: z
      .array(
        z.discriminatedUnion("action", [
          z
            .object({ bookingId: idOf("That is not a booking."), action: z.literal("cancel") })
            .strict(),
          z
            .object({
              bookingId: idOf("That is not a booking."),
              action: z.literal("move"),
              date: dateOf,
              startMinute: z.int("Pick a time.").min(0, "Pick a time.").max(1439, "Pick a time."),
              personId: idOf("Pick who does it."),
            })
            .strict(),
        ]),
        "That is not a list of bookings."
      )
      .max(100, "That is too many bookings for one save.")
      .refine(
        (choices) => new Set(choices.map((choice) => choice.bookingId)).size === choices.length,
        "A booking can have one choice only."
      ),
  })
  .strict();

export type TimeOffType = z.infer<typeof timeOffValidationSchema>;
export type TimeOffInputType = z.input<typeof timeOffValidationSchema>;
