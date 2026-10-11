// Backend: the weekday of a YYYY-MM-DD date, as the week's keys name it.

import type { WeeklyHoursType } from "@scheduleads-app/shared/zod-validation";

const WEEKDAYS: (keyof WeeklyHoursType)[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function weekdayOf(date: string): keyof WeeklyHoursType {
  const [year, month, day] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]; // a calendar date has no zone
}
