// Backend: the Monday of the week a date is in; the Calendar page's weeks run Monday to Sunday.

import { addDays } from "@scheduleads-app/shared/add-days";

export function mondayOf(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // a calendar date has no zone
  return addDays(date, weekday === 0 ? -6 : 1 - weekday);
}
