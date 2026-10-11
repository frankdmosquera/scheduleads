// Backend: closes one day for everyone from the owner's Days off page (feature 12e), and lists the
// upcoming bookings left on it. What it writes is decided in apply-opening-rules.ts.

import { applyClosingRules } from "../bookable-hours/apply-opening-rules.js";
import { writeDaysOff, type WriteDaysOffResultType } from "./write-days-off.js";

export function closeDay(
  organizationId: string,
  date: string, // YYYY-MM-DD
  now: Date
): Promise<WriteDaysOffResultType> {
  return writeDaysOff(
    organizationId,
    (before) => ({
      holidayCountry: before.holidayCountry,
      holidayRegion: before.holidayRegion,
      closedHolidays: before.closedHolidays,
      ...applyClosingRules(before, date),
    }),
    now
  );
}
