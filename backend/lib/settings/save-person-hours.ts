// Backend: saves one person's hours from their card on the owner's Hours section (feature 12a).

import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule, resource } from "@scheduleads-app/shared/db";
import type { PersonHoursType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import type { PersonHoursSettingsType } from "./find-hours-settings.js";
import { sortedHours } from "./sorted-hours.js";

export type SavePersonHoursResultType =
  | { ok: true; person: PersonHoursSettingsType }
  | { ok: false; reason: "no_person" | "no_business_hours" };

// Makes or updates the person's row; back on the business's week it keeps their one-off dates.
// The row is never deleted here.
export async function savePersonHours(
  organizationId: string,
  personId: string,
  hours: PersonHoursType
): Promise<SavePersonHoursResultType> {
  // Another business's person, a place and an unknown id are all "no person".
  const [person] = await db
    .select({ id: resource.id, name: resource.name })
    .from(resource)
    .where(
      and(
        eq(resource.organizationId, organizationId),
        eq(resource.id, personId),
        eq(resource.kind, "person"),
        eq(resource.active, true)
      )
    )
    .limit(1);
  if (!person) return { ok: false, reason: "no_person" };

  // A person's hours mean nothing until the business has its own: its time zone and notice.
  const [businessRow] = await db
    .select({ id: availabilityRule.id })
    .from(availabilityRule)
    .where(
      and(eq(availabilityRule.organizationId, organizationId), isNull(availabilityRule.resourceId))
    )
    .limit(1);
  if (!businessRow) return { ok: false, reason: "no_business_hours" };

  const { weeklyHours, dateHours } = sortedHours(hours);
  await db
    .insert(availabilityRule)
    .values({ id: randomUUID(), organizationId, resourceId: person.id, weeklyHours, dateHours })
    .onConflictDoUpdate({
      target: [availabilityRule.organizationId, availabilityRule.resourceId],
      set: { weeklyHours, dateHours },
    });

  return { ok: true, person: { id: person.id, name: person.name, weeklyHours, dateHours } };
}
