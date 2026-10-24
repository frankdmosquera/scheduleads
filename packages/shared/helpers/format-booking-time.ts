// Shared: a booking's time as the emails and the customer's page say it, in the business's own
// zone with the zone named: "Thursday, October 8 at 9:00 a.m. MDT", or in Spanish "Jueves, 8 de
// octubre, 9:00 a. m. GMT-6". Never the server's or the browser's zone; Railway runs UTC.

import type { BookingLanguageType } from "../zod-validation/booking-links-validation-schemas/booking-language-validation-schema.js";

// The Intl locale each language is written with: Canada's English, as before Spanish came, and
// Latin American Spanish, one Spanish for every Spanish-speaking business (feature 12i).
export const intlLocaleOf: Record<BookingLanguageType, string> = { en: "en-CA", es: "es-419" };

// Spanish names a day or month in lowercase; a time shown on its own line starts with a capital.
export function capitalized(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

export function formatBookingTime(
  moment: Date,
  timeZone: string,
  language: BookingLanguageType = "en"
): string {
  return capitalized(
    new Intl.DateTimeFormat(intlLocaleOf[language], {
      timeZone,
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(moment)
  );
}
