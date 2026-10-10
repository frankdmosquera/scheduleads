// Backend: what the owner's Hours section shows: the business's hours and every active person's.

import { and, asc, eq, isNull } from "drizzle-orm";

import { availabilityRule, resource } from "@scheduleads-app/shared/db";
import type { BusinessHoursType, PersonHoursType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { businessHoursOf } from "./business-hours-of.js";

export type PersonHoursSettingsType = { id: string; name: string } & PersonHoursType;

export type HoursSettingsType = {
  business: BusinessHoursType | null; // null until the business's hours are first saved
  people: PersonHoursSettingsType[];
};

export async function findHoursSettings(organizationId: string): Promise<HoursSettingsType> {
  const [businessRow] = await db
    .select()
    .from(availabilityRule)
    .where(
      and(eq(availabilityRule.organizationId, organizationId), isNull(availabilityRule.resourceId))
    )
    .limit(1);

  // A person with no row follows the business's week and has no one-off dates.
  const people = await db
    .select({
      id: resource.id,
      name: resource.name,
      weeklyHours: availabilityRule.weeklyHours,
      dateHours: availabilityRule.dateHours,
    })
    .from(resource)
    .leftJoin(
      availabilityRule,
      and(
        eq(availabilityRule.organizationId, resource.organizationId),
        eq(availabilityRule.resourceId, resource.id)
      )
    )
    .where(
      and(
        eq(resource.organizationId, organizationId),
        eq(resource.kind, "person"),
        eq(resource.active, true)
      )
    )
    .orderBy(asc(resource.name), asc(resource.id));

  return {
    business: businessRow ? businessHoursOf(businessRow) : null,
    people: people.map((person) => ({
      id: person.id,
      name: person.name,
      weeklyHours: person.weeklyHours ?? null,
      dateHours: person.dateHours ?? [],
    })),
  };
}
