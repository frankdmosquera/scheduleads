// Backend: saves the business's closed dates and holiday picks from the owner's Days off page
// (feature 12e). Only those four columns: the hours, one-off dates included, stay as they are.

import type { DaysOffType } from "@scheduleads-app/shared/zod-validation";

import { writeDaysOff, type WriteDaysOffResultType } from "./write-days-off.js";

export function saveDaysOff(
  organizationId: string,
  daysOff: DaysOffType,
  now: Date
): Promise<WriteDaysOffResultType> {
  return writeDaysOff(
    organizationId,
    (before) => ({
      ...daysOff,
      closedDates: [...daysOff.closedDates].sort(), // YYYY-MM-DD sorts as text
      dateHours: before.dateHours,
    }),
    now
  );
}
