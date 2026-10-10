// Backend: the Hours card's view of the business's availability_rule row.

import type { availabilityRule } from "@scheduleads-app/shared/db";
import type { BusinessHoursType } from "@scheduleads-app/shared/zod-validation";

// The database check guarantees these on the business's row; one missing is a corrupt row, a real
// fault, so it throws instead of showing the owner empty hours.
export function businessHoursOf(row: typeof availabilityRule.$inferSelect): BusinessHoursType {
  const { weeklyHours, timezone, minimumNoticeMinutes, horizonDays } = row;
  if (
    weeklyHours === null ||
    timezone === null ||
    minimumNoticeMinutes === null ||
    horizonDays === null
  ) {
    throw new Error(`availability_rule ${row.id} is the business's row but is missing a setting.`);
  }
  return { weeklyHours, dateHours: row.dateHours, timezone, minimumNoticeMinutes, horizonDays };
}
