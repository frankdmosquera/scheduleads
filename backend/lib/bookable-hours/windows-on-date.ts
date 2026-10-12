// Backend: the bookable windows on one date of resolved hours: a one-off date replaces that day's
// week. The booking window and the calendar (feature 12b) both read a day this way.

import type { TimeWindowType } from "@scheduleads-app/shared/zod-validation";

import type { ResolvedBookableHoursType } from "./apply-bookable-hours-rules.js";
import { weekdayOf } from "./weekday-of.js";

export function windowsOnDate(
  hours: Pick<ResolvedBookableHoursType, "weeklyHours" | "dateHours">,
  date: string // YYYY-MM-DD in the business's zone
): TimeWindowType[] {
  return (
    hours.dateHours.find((entry) => entry.date === date)?.windows ??
    hours.weeklyHours[weekdayOf(date)] ??
    []
  );
}
