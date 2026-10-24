// Backend: the Days off page's holiday picker (feature 12e): the countries offered, the picked
// country's provinces, and its holidays for the coming year.

import { and, eq, isNull } from "drizzle-orm";

import { addDays } from "@scheduleads-app/shared/add-days";
import { availabilityRule } from "@scheduleads-app/shared/db";
import { localDate } from "@scheduleads-app/shared/local-date";

import { db } from "../../database.js";
import { DAYS_OFF_AHEAD } from "../bookable-hours/apply-opening-rules.js";
import { holidayChoices, type HolidayChoiceType } from "../bookable-hours/holiday-choices.js";
import {
  holidayPackage,
  type HolidayLanguageType,
  type HolidayPlaceType,
} from "../bookable-hours/holiday-package.js";

export type HolidayChoicesResultType =
  | {
      ok: true;
      countries: HolidayPlaceType[];
      regions: HolidayPlaceType[]; // the country's provinces; none before a country is picked
      holidays: HolidayChoiceType[]; // the country's, and the province's when one is picked
      today: string; // YYYY-MM-DD on the business's clock, where the year shown starts
    }
  | { ok: false; field: "holidayCountry" | "holidayRegion"; message: string };

export async function findHolidayChoices(
  organizationId: string,
  country: string | null,
  region: string | null,
  now: Date,
  language: HolidayLanguageType = "en"
): Promise<HolidayChoicesResultType> {
  const countries = holidayPackage.countries(language);
  if (country === null) return { ok: true, countries, regions: [], holidays: [], today: "" };

  const regions = holidayPackage.regions(country);
  if (!regions)
    return { ok: false, field: "holidayCountry", message: "Pick a country from the list." };
  if (region !== null && !regions.some((place) => place.code === region))
    return { ok: false, field: "holidayRegion", message: "Pick a province from the list." };

  // The year the page shows, from today on the business's clock (UTC before its hours are set).
  const [row] = await db
    .select({ timezone: availabilityRule.timezone })
    .from(availabilityRule)
    .where(
      and(eq(availabilityRule.organizationId, organizationId), isNull(availabilityRule.resourceId))
    )
    .limit(1);
  const today = localDate(now, row?.timezone ?? "UTC");
  const holidays = holidayChoices(country, region, today, addDays(today, DAYS_OFF_AHEAD), language);
  return { ok: true, countries, regions, holidays, today };
}
