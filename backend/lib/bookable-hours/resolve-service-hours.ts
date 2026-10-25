// Backend: when a service runs (feature 12k), resolved like a person's hours: its own week or the
// business's, with its one-off dates. null when it has no row of its own (it runs whenever the
// business is open, so nothing narrows) or the business has no hours yet.

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule, serviceHours } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import {
  applyBookableHoursRules,
  type ResolvedBookableHoursType,
} from "./apply-bookable-hours-rules.js";
import { businessHoursInputOf } from "./business-hours-input-of.js";

export async function resolveServiceHours(
  organizationId: string,
  bookingLinkId: string,
  now: Date
): Promise<ResolvedBookableHoursType | null> {
  const [row] = await db
    .select({ weeklyHours: serviceHours.weeklyHours, dateHours: serviceHours.dateHours })
    .from(serviceHours)
    .where(
      and(
        eq(serviceHours.organizationId, organizationId),
        eq(serviceHours.bookingLinkId, bookingLinkId)
      )
    )
    .limit(1);
  if (!row) return null;

  const [businessRow] = await db
    .select()
    .from(availabilityRule)
    .where(
      and(eq(availabilityRule.organizationId, organizationId), isNull(availabilityRule.resourceId))
    )
    .limit(1);
  if (!businessRow) return null;

  return applyBookableHoursRules(businessHoursInputOf(businessRow), row, now);
}
