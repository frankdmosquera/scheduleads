// Backend: each free start time with the business's date and clock time beside it, "2026-11-02" and
// "9:00 a.m.", and the whole moment as the emails say it, in the language the window asked for,
// worked out here with the API's own time-zone rules. The booking window and the customer's page
// show these as sent, never re-deriving them with the visitor's browser, whose rules may be older.

import { formatBookingTime, intlLocaleOf } from "@scheduleads-app/shared/booking-time";
import { localDate } from "@scheduleads-app/shared/local-date";
import type { BookingLanguageType } from "@scheduleads-app/shared/zod-validation";

export type LocalStartTimeType = {
  startsAt: string; // ISO 8601 instant in UTC
  date: string; // YYYY-MM-DD in the business's zone
  time: string; // "9:00 a.m." on the business's clock
  when: string; // "Monday, November 2 at 9:00 a.m. MDT", as the emails say it
};

export function localStartTimes(
  startTimes: string[],
  timeZone: string,
  language: BookingLanguageType = "en"
): LocalStartTimeType[] {
  const clock = new Intl.DateTimeFormat(intlLocaleOf[language], {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  return startTimes.map((startsAt) => {
    const moment = new Date(startsAt);
    return {
      startsAt,
      date: localDate(moment, timeZone),
      time: clock.format(moment),
      when: formatBookingTime(moment, timeZone, language),
    };
  });
}
