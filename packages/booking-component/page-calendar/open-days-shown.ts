// Booking component: the days a page calendar marks open in one month. A month built into the page
// takes its open days from there, dropping any that passed since it was built; a later month takes
// the ones its live read found.

import { addDays } from "@scheduleads-app/shared/add-days";

import type { BookingStartTimeType } from "../api-client/booking-api-types.js";
import { bookableMonths } from "../booking-window/month-calendar/bookable-months.js";
import { shiftMonth } from "../booking-window/month-calendar/shift-month.js";
import type { PageCalendarDataType } from "./fetch-page-calendar.js";

type LiveMonthType =
  | { state: "loading" }
  | { state: "ok"; days: Map<string, BookingStartTimeType[]> }
  | { state: "times-unreadable"; message: string }
  | { state: "problem"; problem: unknown };

/**
 * Whether a month's open days can come from the page: it was read when the page was built, and that
 * read reached as far into it as a read today would. A page a day or more old would otherwise hide
 * the days that became bookable since (13c.1 review); those months are read live instead.
 */
export function monthIsBuiltIn(
  month: string,
  today: string,
  calendar: Pick<PageCalendarDataType, "months" | "today" | "horizonDays">
): boolean {
  if (!calendar.months.includes(month)) return false;
  const monthEnd = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const reachToday = bookableMonths(today, calendar.horizonDays).lastDate;
  const reachBuilt = bookableMonths(calendar.today, calendar.horizonDays).lastDate;
  const needed = monthEnd < reachToday ? monthEnd : reachToday; // YYYY-MM-DD sorts as text
  return needed <= reachBuilt;
}

export function openDaysShown(
  month: string, // YYYY-MM
  today: string, // YYYY-MM-DD on the business's clock, in the browser
  calendar: Pick<PageCalendarDataType, "months" | "openDays" | "today" | "horizonDays">,
  liveMonth: LiveMonthType
): Set<string> {
  if (monthIsBuiltIn(month, today, calendar)) {
    return new Set(calendar.openDays.filter((day) => day.startsWith(`${month}-`) && day >= today));
  }
  return liveMonth.state === "ok" ? new Set(liveMonth.days.keys()) : new Set();
}
