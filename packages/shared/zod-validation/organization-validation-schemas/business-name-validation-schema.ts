// Shared Zod schema: a business's name, wherever one is typed (setting up a client today).

import { z } from "zod";

import { toSlug } from "../../helpers/to-slug.js";

export const businessNameValidationSchema = z
  .string()
  .trim()
  .min(2, "Enter the business's name.")
  .max(80, "That name is too long.")
  // The address is made from the name, so a name of only punctuation or emoji has none.
  .refine((name) => toSlug(name) !== "", "Use at least a couple of letters or numbers.")
  // "/public/bookings/..." is where a customer's own booking page asks (features 7a and 7b), so no
  // business may have the address "bookings".
  .refine(
    (name) => toSlug(name) !== "bookings",
    "That name is taken by the app. Add a word to it."
  );
