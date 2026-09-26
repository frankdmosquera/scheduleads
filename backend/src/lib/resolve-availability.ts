// Backend: when can a customer book this business, or one person in it? The one place
// that question is answered. Reads the rows here; the rules live in availability-rules.ts.

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule, resource } from "@scheduleads-app/shared/db";

import { db } from "../database.js";
import {
  applyAvailabilityRules,
  type BusinessHoursInputType,
  type ResolvedAvailabilityType,
} from "./availability-rules.js";

type AvailabilityRuleRowType = typeof availabilityRule.$inferSelect;

// The database check guarantees these on the business's row. A row without them is a
// corrupt row, a real fault, so it throws instead of being read as "closed".
function toBusinessHours(row: AvailabilityRuleRowType): BusinessHoursInputType {
  const { weeklyHours, timezone, minimumNoticeMinutes, horizonDays, closedDates } = row;
  if (
    weeklyHours === null ||
    timezone === null ||
    minimumNoticeMinutes === null ||
    horizonDays === null ||
    closedDates === null
  ) {
    throw new Error(`availability_rule ${row.id} is the business's row but is missing a setting.`);
  }
  return {
    weeklyHours,
    dateHours: row.dateHours,
    timezone,
    minimumNoticeMinutes,
    horizonDays,
    closedDates,
  };
}

// null when the business has no hours yet, or the person is not one of its own.
export async function resolveAvailability(
  organizationId: string,
  resourceId: string | null, // null = the business's own hours
  now: Date // a parameter, not new Date() inside, so the horizon can be tested
): Promise<ResolvedAvailabilityType | null> {
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

  const business = toBusinessHours(businessRow);

  if (resourceId === null) return applyAvailabilityRules(business, null, now);

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

  return applyAvailabilityRules(business, personRow ?? null, now);
}
