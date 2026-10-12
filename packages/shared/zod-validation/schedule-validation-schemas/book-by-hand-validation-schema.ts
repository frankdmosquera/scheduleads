// Shared Zod schema: a booking the owner makes by hand on the Calendar page (feature 12b), a phone
// estimate or a walk-in. The time is the business's own clock, a date and a minute of the day, so
// the API turns it into a moment in the business's zone; the business comes from the session.

import { z } from "zod";

import { contactValidationSchema } from "../crm-validation-schemas/contact-validation-schema.js";
import { bookingLinkIdValidationSchema } from "../booking-links-validation-schemas/booking-link-id-validation-schema.js";

const idOf = (message: string) => z.string(message).regex(/^[A-Za-z0-9_-]{1,64}$/, message);

export const bookByHandValidationSchema = z
  .object({
    bookingLinkId: bookingLinkIdValidationSchema,
    personId: idOf("Pick who does it."),
    date: z
      .string("Pick a day.")
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a day.")
      .refine((date) => {
        const [year, month, day] = date.split("-").map(Number);
        const parsed = new Date(Date.UTC(year, month - 1, day));
        return parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
      }, "That day does not exist."),
    startMinute: z.int("Pick a time.").min(0, "Pick a time.").max(1439, "Pick a time."),
    // The owner, booking from a phone call, needs only a name (5d); the rest is for later.
    customer: contactValidationSchema,
    location: z.string().trim().min(1).max(300, "That address is too long.").optional(),
    details: z.string().trim().max(2000, "Keep it to 2000 characters.").optional(),
  })
  .strict();

export type BookByHandType = z.infer<typeof bookByHandValidationSchema>;
export type BookByHandInputType = z.input<typeof bookByHandValidationSchema>;
