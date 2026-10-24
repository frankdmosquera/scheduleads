// Booking component: a date as a day button says it, "Wednesday, October 14" or "Miércoles, 14 de
// octubre". The date is already the business's, so it is read in UTC and no zone can move it.

import { capitalized, intlLocaleOf } from "@scheduleads-app/shared/booking-time";
import type { BookingLanguageType } from "@scheduleads-app/shared/zod-validation";

export function formatDayName(date: string, language: BookingLanguageType = "en"): string {
  const dayNameFormat = new Intl.DateTimeFormat(intlLocaleOf[language], {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return capitalized(dayNameFormat.format(new Date(`${date}T00:00:00Z`)));
}
