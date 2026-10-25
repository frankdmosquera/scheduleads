// Backend: a week open all day every day (feature 12k): what a service that runs whenever the
// business is open is overlapped with, so it narrows nothing on an ordinary day, whatever the
// people's own weeks; only its own one-off dates narrow.

import type { WeeklyHoursType } from "@scheduleads-app/shared/zod-validation";

const allDay = [{ startMinute: 0, endMinute: 1440 }];

export const ALL_DAY_WEEK: WeeklyHoursType = {
  mon: allDay,
  tue: allDay,
  wed: allDay,
  thu: allDay,
  fri: allDay,
  sat: allDay,
  sun: allDay,
};
