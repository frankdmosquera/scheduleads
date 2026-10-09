// Booking component: the free start times grouped by their date in the business's zone, in order.
// A 7 a.m. start in Edmonton is already the next day in UTC; the business's date is the one shown.

import { localDate } from "@scheduleads-app/shared/local-date";

export function groupTimesByDay(startTimes: string[], timeZone: string): Map<string, string[]> {
  const days = new Map<string, string[]>();
  for (const startsAt of startTimes) {
    const date = localDate(new Date(startsAt), timeZone);
    days.set(date, [...(days.get(date) ?? []), startsAt]);
  }
  return days;
}
