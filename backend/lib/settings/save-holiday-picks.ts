// Backend: saves the holidays the owner picked on the Days off page (feature 12e): the country, the
// province and the picks. The closed dates and the hours stay as they are saved, so a page loaded
// before a day was closed elsewhere never opens it again.

import type { HolidayPicksType } from "@scheduleads-app/shared/zod-validation";

import { writeDaysOff, type WriteDaysOffResultType } from "./write-days-off.js";

export function saveHolidayPicks(
  organizationId: string,
  picks: HolidayPicksType,
  now: Date
): Promise<WriteDaysOffResultType> {
  return writeDaysOff(
    organizationId,
    (before) => ({ ...picks, closedDates: before.closedDates, dateHours: before.dateHours }),
    now
  );
}
