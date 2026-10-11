// Backend: the business's availability_rule row as the bookable hours rules read it.

import type { availabilityRule } from "@scheduleads-app/shared/db";

import type { BusinessHoursInputType } from "./apply-bookable-hours-rules.js";

// The database check guarantees these on the business's row. A row without them is a
// corrupt row, a real fault, so it throws instead of being read as "closed".
export function businessHoursInputOf(
  row: typeof availabilityRule.$inferSelect
): BusinessHoursInputType {
  const { weeklyHours, timezone, minimumNoticeMinutes, horizonDays, closedDates } = row;
  if (
    weeklyHours === null ||
    timezone === null ||
    minimumNoticeMinutes === null ||
    horizonDays === null ||
    closedDates === null
  ) {
    throw new Error(`availability_rule ${row.id} is the business's row but is missing a setting.`);
  }
  return {
    weeklyHours,
    dateHours: row.dateHours,
    timezone,
    minimumNoticeMinutes,
    horizonDays,
    closedDates,
    holidayCountry: row.holidayCountry,
    holidayRegion: row.holidayRegion,
    closedHolidays: row.closedHolidays,
  };
}
