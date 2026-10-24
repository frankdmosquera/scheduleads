// Booking component: a date as the window names it, "Wednesday, October 14" or "miércoles, 14 de
// octubre", lowercase in Spanish as in a sentence; a screen capitalizes it where it starts a line.
// The date is already the business's, so it is read in UTC and no zone can move it.

import { intlLocaleOf } from "@scheduleads-app/shared/booking-time";
import type { BookingLanguageType } from "@scheduleads-app/shared/zod-validation";

export function formatDayName(date: string, language: BookingLanguageType = "en"): string {
  const dayNameFormat = new Intl.DateTimeFormat(intlLocaleOf[language], {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return dayNameFormat.format(new Date(`${date}T00:00:00Z`));
}
