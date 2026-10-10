// Backend: saves the business's hours from the owner's Hours card (feature 12a).

import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { availabilityRule } from "@scheduleads-app/shared/db";
import type { BusinessHoursType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { sortedHours } from "./sorted-hours.js";

// The first save makes the business's row with no closed days and no holidays; every later save
// changes only these five columns, so the closed days screen's settings (12e) stay as they are.
// One statement, so two first saves at once still make one row.
export async function saveBusinessHours(
  organizationId: string,
  hours: BusinessHoursType
): Promise<BusinessHoursType> {
  const saved = { ...hours, ...sortedHours(hours) };
  const { weeklyHours, dateHours, timezone, minimumNoticeMinutes, horizonDays } = saved;

  await db
    .insert(availabilityRule)
    .values({
      id: randomUUID(),
      organizationId,
      resourceId: null,
      weeklyHours,
      dateHours,
      timezone,
      minimumNoticeMinutes,
      horizonDays,
      closedDates: [],
    })
    .onConflictDoUpdate({
      target: availabilityRule.organizationId,
      targetWhere: sql`${availabilityRule.resourceId} is null`, // the business row's own index
      set: { weeklyHours, dateHours, timezone, minimumNoticeMinutes, horizonDays },
    });

  return saved;
}
