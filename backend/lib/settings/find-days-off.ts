// Backend: what the owner's Days off page shows (feature 12e): the closed days and holiday picks as
// saved, every closed day from today to a year ahead with who it is opened for, and the people.

import { and, asc, eq, isNull } from "drizzle-orm";

import { availabilityRule, resource } from "@scheduleads-app/shared/db";
import { localDate } from "@scheduleads-app/shared/local-date";
import type { DaysOffType } from "@scheduleads-app/shared/zod-validation";

import type { DatabaseExecutorType } from "../../database-executor-type.js";
import { listClosedDays, type ClosedDayType } from "../bookable-hours/apply-opening-rules.js";
import { businessHoursInputOf } from "../bookable-hours/business-hours-input-of.js";
import { findPeopleHours } from "./find-people-hours.js";

export type DaysOffSettingsType = DaysOffType & {
  timezone: string | null; // null until the business's hours are first saved
  closedDays: ClosedDayType[];
  people: { id: string; name: string }[]; // the active people, whom a day can be opened for
};

export async function findDaysOff(
  executor: DatabaseExecutorType,
  organizationId: string,
  now: Date
): Promise<DaysOffSettingsType> {
  const [[businessRow], peopleHours, people] = await Promise.all([
    executor
      .select()
      .from(availabilityRule)
      .where(
        and(
          eq(availabilityRule.organizationId, organizationId),
          isNull(availabilityRule.resourceId)
        )
      )
      .limit(1),
    findPeopleHours(executor, organizationId),
    executor
      .select({ id: resource.id, name: resource.name })
      .from(resource)
      .where(
        and(
          eq(resource.organizationId, organizationId),
          eq(resource.kind, "person"),
          eq(resource.active, true)
        )
      )
      .orderBy(asc(resource.name), asc(resource.id)),
  ]);

  if (!businessRow) {
    const none = { closedDates: [], holidayCountry: null, holidayRegion: null, closedHolidays: [] };
    return { ...none, timezone: null, closedDays: [], people };
  }

  const business = businessHoursInputOf(businessRow);
  const today = localDate(now, business.timezone);
  // Only the active people are named as opened for: someone turned off is offered nothing anyway.
  const activeHours = new Map(
    people.map((person) => [
      person.id,
      peopleHours.get(person.id) ?? { weeklyHours: null, dateHours: [] },
    ])
  );
  return {
    closedDates: business.closedDates.filter((date) => date >= today).sort(), // YYYY-MM-DD sorts as text
    holidayCountry: business.holidayCountry,
    holidayRegion: business.holidayRegion,
    closedHolidays: business.closedHolidays,
    timezone: business.timezone,
    closedDays: listClosedDays(business, activeHours, now),
    people,
  };
}
