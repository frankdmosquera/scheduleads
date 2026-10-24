// Booking component: the business's zone as the calendar names it, "Mountain Time" or "hora de la
// montaña": the same name summer and winter, unlike "MDT" and "MST".

import { intlLocaleOf } from "@scheduleads-app/shared/booking-time";
import type { BookingLanguageType } from "@scheduleads-app/shared/zod-validation";

export function formatZoneName(timeZone: string, language: BookingLanguageType = "en"): string {
  const parts = new Intl.DateTimeFormat(intlLocaleOf[language], {
    timeZone,
    timeZoneName: "longGeneric",
  }).formatToParts(new Date());
  return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
}
