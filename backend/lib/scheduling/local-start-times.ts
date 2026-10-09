// Backend: each free start time with the business's date and clock time beside it, "2026-11-02" and
// "9:00 a.m.", worked out here with the API's own time-zone rules. The booking window shows these
// as sent, never re-deriving them with the visitor's browser, whose rules may be older (F-279).

import { localDate } from "@scheduleads-app/shared/local-date";

export type LocalStartTimeType = {
  startsAt: string; // ISO 8601 instant in UTC
  date: string; // YYYY-MM-DD in the business's zone
  time: string; // "9:00 a.m." on the business's clock
};

export function localStartTimes(startTimes: string[], timeZone: string): LocalStartTimeType[] {
  const clock = new Intl.DateTimeFormat("en-CA", { timeZone, hour: "numeric", minute: "2-digit" });
  return startTimes.map((startsAt) => {
    const moment = new Date(startsAt);
    return { startsAt, date: localDate(moment, timeZone), time: clock.format(moment) };
  });
}
