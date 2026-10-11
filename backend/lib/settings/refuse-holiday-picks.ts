// Backend: the Days off save's check on its holidays (feature 12e): the country and province are
// offered, and every pick is in the list the page shows for them.

import type { DaysOffType } from "@scheduleads-app/shared/zod-validation";

import { findHolidayChoices } from "./find-holiday-choices.js";

// Why the picks are refused, with the field, or null when they are all in the list.
export async function refuseHolidayPicks(
  organizationId: string,
  daysOff: DaysOffType,
  now: Date
): Promise<{ field: string; message: string } | null> {
  if (daysOff.holidayCountry === null) return null; // no picks without a country: the schema checks
  const choices = await findHolidayChoices(
    organizationId,
    daysOff.holidayCountry,
    daysOff.holidayRegion,
    now
  );
  if (!choices.ok) return { field: choices.field, message: choices.message };
  const known = new Set(choices.holidays.map((holiday) => holiday.name));
  const unknown = daysOff.closedHolidays.find((name) => !known.has(name));
  if (unknown === undefined) return null;
  return { field: "closedHolidays", message: `${unknown} is not in the holiday list: untick it.` };
}
