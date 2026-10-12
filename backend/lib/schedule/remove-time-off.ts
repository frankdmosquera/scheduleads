// Backend: takes one stretch of time off away (feature 12b), so its time is free again at once.
// Only time off of this business, never a booking's held time.

import { and, eq } from "drizzle-orm";

import { commitment } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { releaseTime } from "../scheduling/release-time.js";

// false when there is no such active time off in this business.
export async function removeTimeOff(organizationId: string, timeOffId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: commitment.id })
    .from(commitment)
    .where(
      and(
        eq(commitment.organizationId, organizationId),
        eq(commitment.id, timeOffId),
        eq(commitment.kind, "time_off"),
        eq(commitment.status, "active")
      )
    )
    .limit(1);
  if (!row) return false;
  return (await releaseTime(organizationId, [row.id])) > 0;
}
