// Booking component: the dates of one month worth asking the API about, cut to today through the
// last bookable date. Never more than 31, the route's own limit. Null when none can be booked.

import { addDays } from "@scheduleads-app/shared/add-days";

import type { BookableMonthsType } from "./bookable-months.js";
import { shiftMonth } from "./shift-month.js";

export function datesToAsk(
  month: string,
  bounds: BookableMonthsType
): { from: string; to: string } | null {
  const firstDay = `${month}-01`;
  const lastDay = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const from = firstDay > bounds.today ? firstDay : bounds.today; // YYYY-MM-DD sorts as text
  const to = lastDay < bounds.lastDate ? lastDay : bounds.lastDate;
  return from > to ? null : { from, to };
}
