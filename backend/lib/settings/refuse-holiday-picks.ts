// Backend: the Days off save's check on its holidays (feature 12e): the country and province are
// offered, and every pick is a name the holiday list still has.

import type { HolidayPicksType } from "@scheduleads-app/shared/zod-validation";

import { unknownHolidayPicks } from "../bookable-hours/unknown-holiday-picks.js";
import { findHolidayChoices } from "./find-holiday-choices.js";

// Why the picks are refused, with the field, or null when the list knows them all. A pick that is
// not in the coming year (a substitute day) is kept.
export async function refuseHolidayPicks(
  organizationId: string,
  picks: HolidayPicksType,
  now: Date
): Promise<{ field: string; message: string } | null> {
  if (picks.holidayCountry === null) return null; // no picks without a country: the schema checks
  const choices = await findHolidayChoices(
    organizationId,
    picks.holidayCountry,
    picks.holidayRegion,
    now
  );
  if (!choices.ok) return { field: choices.field, message: choices.message };
  const [unknown] = unknownHolidayPicks(
    picks.holidayCountry,
    picks.holidayRegion,
    picks.closedHolidays,
    choices.today
  );
  if (unknown === undefined) return null;
  return { field: "closedHolidays", message: `${unknown} is not in the holiday list: untick it.` };
}
