// Backend: when can a customer book this business, or one person in it? The one place
// that question is answered. Reads the rows here; the rules live in apply-bookable-hours-rules.ts.

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule, resource } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import {
  applyBookableHoursRules,
  type ResolvedBookableHoursType,
} from "./apply-bookable-hours-rules.js";
import { businessHoursInputOf } from "./business-hours-input-of.js";

// null when the business has no hours yet, or the person is not one of its own.
export async function resolveBookableHours(
  organizationId: string,
  resourceId: string | null, // null = the business's own hours
  now: Date // a parameter, not new Date() inside, so the horizon can be tested
): Promise<ResolvedBookableHoursType | null> {
  // Every query filters on the business first, so a person id from another business
  // finds nothing here.
  const [businessRow] = await db
    .select()
    .from(availabilityRule)
    .where(
      and(eq(availabilityRule.organizationId, organizationId), isNull(availabilityRule.resourceId))
    )
    .limit(1);

  if (!businessRow) return null;

  const business = businessHoursInputOf(businessRow);

  if (resourceId === null) return applyBookableHoursRules(business, null, now);

  // The person must exist in this business. Without this, another business's person
  // would simply have no row here and quietly get this business's week.
  const [person] = await db
    .select({ id: resource.id })
    .from(resource)
    .where(and(eq(resource.organizationId, organizationId), eq(resource.id, resourceId)))
    .limit(1);

  if (!person) return null;

  // No row for the person is normal: they follow the business's week.
  const [personRow] = await db
    .select({ weeklyHours: availabilityRule.weeklyHours, dateHours: availabilityRule.dateHours })
    .from(availabilityRule)
    .where(
      and(
        eq(availabilityRule.organizationId, organizationId),
        eq(availabilityRule.resourceId, resourceId)
      )
    )
    .limit(1);

  return applyBookableHoursRules(business, personRow ?? null, now);
}
