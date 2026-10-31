// Booking component: the days a page calendar marks open in one month. A month built into the page
// takes its open days from there, dropping any that passed since it was built; a later month takes
// the ones its live read found.

import type { BookingStartTimeType } from "../api-client/booking-api-types.js";
import type { PageCalendarDataType } from "./fetch-page-calendar.js";

type LiveMonthType =
  | { state: "loading" }
  | { state: "ok"; days: Map<string, BookingStartTimeType[]> }
  | { state: "times-unreadable"; message: string }
  | { state: "problem"; problem: unknown };

export function openDaysShown(
  month: string, // YYYY-MM
  today: string, // YYYY-MM-DD on the business's clock, in the browser
  calendar: Pick<PageCalendarDataType, "months" | "openDays">,
  liveMonth: LiveMonthType
): Set<string> {
  if (calendar.months.includes(month)) {
    return new Set(calendar.openDays.filter((day) => day.startsWith(`${month}-`) && day >= today));
  }
  return liveMonth.state === "ok" ? new Set(liveMonth.days.keys()) : new Set();
}
