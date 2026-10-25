// Backend: when a service runs (feature 12k), resolved like a person's hours: its own week, or all
// day when it runs whenever the business is open, with only its own one-off dates. null when it has
// no row of its own (nothing narrows) or the business has no hours yet.

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule, serviceHours } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import {
  applyBookableHoursRules,
  type ResolvedBookableHoursType,
} from "./apply-bookable-hours-rules.js";
import { ALL_DAY_WEEK } from "./all-day-week.js";
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

  // Whenever open narrows nothing on an ordinary day, as with no row; only its own one-off dates do,
  // never the business's (they already reach whoever follows the business's week).
  const week = row.weeklyHours ?? ALL_DAY_WEEK;
  return applyBookableHoursRules(
    businessHoursInputOf(businessRow),
    { weeklyHours: week, dateHours: row.dateHours },
    now
  );
}
