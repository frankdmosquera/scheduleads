// Booking component: a month as the calendar's heading says it, "October 2026" or "Octubre de 2026".

import { capitalized, intlLocaleOf } from "@scheduleads-app/shared/booking-time";
import type { BookingLanguageType } from "@scheduleads-app/shared/zod-validation";

export function formatMonthName(month: string, language: BookingLanguageType = "en"): string {
  const monthNameFormat = new Intl.DateTimeFormat(intlLocaleOf[language], {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
  return capitalized(monthNameFormat.format(new Date(`${month}-01T00:00:00Z`)));
}
