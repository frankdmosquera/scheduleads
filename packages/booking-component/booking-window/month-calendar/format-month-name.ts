// Booking component: a month as the window names it, "October 2026" or "octubre de 2026", lowercase in
// Spanish as in a sentence; the calendar's heading capitalizes it.

import { intlLocaleOf } from "@scheduleads-app/shared/booking-time";
import type { BookingLanguageType } from "@scheduleads-app/shared/zod-validation";

export function formatMonthName(month: string, language: BookingLanguageType = "en"): string {
  const monthNameFormat = new Intl.DateTimeFormat(intlLocaleOf[language], {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
  return monthNameFormat.format(new Date(`${month}-01T00:00:00Z`));
}
