// Backend: a business's time zone, from its business-wide bookable hours. Null before it has any.

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export async function findBusinessTimeZone(organizationId: string): Promise<string | null> {
  const [rule] = await db
    .select({ timezone: availabilityRule.timezone })
    .from(availabilityRule)
    .where(
      and(eq(availabilityRule.organizationId, organizationId), isNull(availabilityRule.resourceId))
    )
    .limit(1);
  return rule?.timezone ?? null;
}
