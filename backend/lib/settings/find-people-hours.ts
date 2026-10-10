// Backend: every person's own hours row in a business, by id, as the outside-hours rules read them
// (no row: they follow the business's week).

import { and, eq, isNotNull } from "drizzle-orm";

import { availabilityRule } from "@scheduleads-app/shared/db";

import type { DatabaseExecutorType } from "../../database-executor-type.js";
import type { HoursRowsType } from "../bookable-hours/apply-outside-hours-rules.js";

export async function findPeopleHours(
  executor: DatabaseExecutorType,
  organizationId: string
): Promise<HoursRowsType["people"]> {
  const rows = await executor
    .select({
      resourceId: availabilityRule.resourceId,
      weeklyHours: availabilityRule.weeklyHours,
      dateHours: availabilityRule.dateHours,
    })
    .from(availabilityRule)
    .where(
      and(
        eq(availabilityRule.organizationId, organizationId),
        isNotNull(availabilityRule.resourceId)
      )
    );
  return new Map(
    rows.map((row) => [row.resourceId!, { weeklyHours: row.weeklyHours, dateHours: row.dateHours }])
  );
}
