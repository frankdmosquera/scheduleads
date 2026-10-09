// Booking component: how far the calendar reaches. From today's month to the month of the last
// bookable date, which is today plus the business's horizon, both in the business's own zone.

import { addDays } from "@scheduleads-app/shared/add-days";

export type BookableMonthsType = {
  today: string; // YYYY-MM-DD
  lastDate: string; // the last date that takes bookings
  firstMonth: string; // YYYY-MM
  lastMonth: string;
};

export function bookableMonths(today: string, horizonDays: number): BookableMonthsType {
  const lastDate = addDays(today, horizonDays); // the API cuts at the same date
  return { today, lastDate, firstMonth: today.slice(0, 7), lastMonth: lastDate.slice(0, 7) };
}
