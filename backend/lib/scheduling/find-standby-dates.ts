// Backend: who is on standby, and on which dates, over a range of the business's own calendar
// dates, both ends included. On a standby date a person is hidden from customers (5c).

import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";

import { standbyDate } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";

export type StandbyDateType = { resourceId: string; date: string }; // date: YYYY-MM-DD

export async function findStandbyDates(
  organizationId: string,
  resourceIds: string[],
  fromDate: string, // YYYY-MM-DD
  toDate: string // YYYY-MM-DD, included
): Promise<StandbyDateType[]> {
  if (resourceIds.length === 0) return [];

  try {
    return await db
      .select({ resourceId: standbyDate.resourceId, date: standbyDate.date })
      .from(standbyDate)
      .where(
        and(
          eq(standbyDate.organizationId, organizationId),
          inArray(standbyDate.resourceId, resourceIds),
          gte(standbyDate.date, fromDate),
          lte(standbyDate.date, toDate)
        )
      )
      .orderBy(asc(standbyDate.date), asc(standbyDate.resourceId));
  } catch (error) {
    throw new Error(`Reading standby failed: ${safeErrorReason(error)}`);
  }
}
