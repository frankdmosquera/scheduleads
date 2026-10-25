// Backend: what the owner's Hours section shows: the business's hours. Each person's are on their
// card on People (feature 12k).

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule } from "@scheduleads-app/shared/db";
import type { BusinessHoursType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { businessHoursOf } from "./business-hours-of.js";

export async function findHoursSettings(organizationId: string): Promise<{
  business: BusinessHoursType | null; // null until the business's hours are first saved
}> {
  const [businessRow] = await db
    .select()
    .from(availabilityRule)
    .where(
      and(eq(availabilityRule.organizationId, organizationId), isNull(availabilityRule.resourceId))
    )
    .limit(1);
  return { business: businessRow ? businessHoursOf(businessRow) : null };
}
