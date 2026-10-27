// Shared Zod schema: the one currency a business's prices are in (feature 25d), an ISO 4217 code
// the runtime's Intl knows, so every price it is given can be written out.

import { z } from "zod";

const KNOWN = new Set(Intl.supportedValuesOf("currency"));

export const currencyValidationSchema = z
  .string()
  .refine((code) => KNOWN.has(code), "Pick a currency from the list.");

// The Services page's "Prices in": null takes the currency off, which hides every price.
export const saveCurrencyValidationSchema = z
  .object({ currency: currencyValidationSchema.nullable() })
  .strict();

export type SaveCurrencyType = z.infer<typeof saveCurrencyValidationSchema>;
