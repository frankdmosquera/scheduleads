// Shared Zod schema: a service as the owner adds or changes it on Settings (feature 12d). Its length
// and buffers are also what a setup file's service is checked with, so the rules live once.

import { z } from "zod";

const MINUTES_IN_A_DAY = 1440;

// A window ends at midnight at the latest, so a longer service could never be offered.
export const serviceLengthValidationSchema = z
  .int({ error: "Use whole minutes." })
  .min(1, "A service takes at least a minute.")
  .max(MINUTES_IN_A_DAY, "A service fits in one day: 1440 minutes at most.");

export const serviceBufferValidationSchema = z
  .int({ error: "Use whole minutes." })
  .min(0, "Use 0 for no time.")
  .max(MINUTES_IN_A_DAY, "1440 minutes at most.");

export const serviceStartEveryValidationSchema = z
  .int({ error: "Use whole minutes." })
  .min(1, "At least every minute.")
  .max(MINUTES_IN_A_DAY, "1440 minutes at most.");

// A price in hundredths of the business's currency (feature 25d): 15000 is 150.00.
export const servicePriceCentsValidationSchema = z
  .int({ error: "Write the price as a number, like 150 or 12.50." })
  .min(0, "A price can't be below 0.")
  .max(100_000_000, "That price is too high.");

const PRICE_FROM_NEEDS_A_PRICE = {
  message: "Give a price before ticking Starts from.",
  path: ["priceFrom"],
};

export const serviceValidationSchema = z
  .object({
    name: z.string().trim().min(1, "Give the service a name.").max(200, "That name is too long."),
    // An empty field on the form means no description.
    description: z
      .string()
      .trim()
      .max(500, "Keep it under 500 characters.")
      .nullable()
      .transform((description) => description || null),
    durationMinutes: serviceLengthValidationSchema,
    bufferBeforeMinutes: serviceBufferValidationSchema,
    bufferAfterMinutes: serviceBufferValidationSchema,
    slotIntervalMinutes: serviceStartEveryValidationSchema.nullable(), // null: every service length
    // The business's choices (decision 30), so the form starts with neither picked.
    personChoice: z.enum(["customer_picks", "business_assigns"], {
      error: "Pick who chooses the person.",
    }),
    // Whether the booking form asks the customer's address, and must have it.
    addressMode: z.enum(["required", "optional", "not_asked"], {
      error: "Pick whether it asks the customer's address.",
    }),
    // Its price (feature 25d). Left out (a form from before prices), the saved one stays.
    priceCents: servicePriceCentsValidationSchema.nullable().optional(),
    priceFrom: z.boolean().optional(), // "From $150": it can cost more
    active: z.boolean(), // false: hidden, no longer offered; its bookings stay
  })
  .strict()
  .refine((service) => !service.priceFrom || service.priceCents != null, PRICE_FROM_NEEDS_A_PRICE);

export type ServiceInputType = z.input<typeof serviceValidationSchema>;
export type ServiceType = z.output<typeof serviceValidationSchema>;
