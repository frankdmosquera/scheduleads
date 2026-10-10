// Booking component: the free start times grouped by the business's date the API sent with each,
// in order. Never re-derived in the browser, whose time-zone rules may be older than the API's.

import type { BookingStartTimeType } from "../../api-client/booking-api-types.js";

export function groupTimesByDay(
  startTimes: BookingStartTimeType[]
): Map<string, BookingStartTimeType[]> {
  const days = new Map<string, BookingStartTimeType[]>();
  for (const startTime of startTimes) {
    days.set(startTime.date, [...(days.get(startTime.date) ?? []), startTime]);
  }
  return days;
}
