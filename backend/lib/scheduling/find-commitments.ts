// Backend: who is taken, and when, over a stretch of time: the active rows of some people and
// places whose time overlaps from to to. Feature 5c subtracts them from bookable hours.

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { commitment } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";

export type CommitmentType = {
  id: string;
  resourceId: string;
  kind: string;
  bookingId: string | null;
  startsAt: Date;
  endsAt: Date;
};

export async function findCommitments(
  organizationId: string,
  resourceIds: string[],
  from: Date,
  to: Date
): Promise<CommitmentType[]> {
  if (resourceIds.length === 0) return [];

  try {
    return await db
      .select({
        id: commitment.id,
        resourceId: commitment.resourceId,
        kind: commitment.kind,
        bookingId: commitment.bookingId,
        startsAt: commitment.startsAt,
        endsAt: commitment.endsAt,
      })
      .from(commitment)
      .where(
        and(
          eq(commitment.organizationId, organizationId),
          inArray(commitment.resourceId, resourceIds),
          eq(commitment.status, "active"),
          // Written as the rule writes it, half-open ranges, so it searches the rule's own index;
          // a row that only meets the stretch's edge does not overlap it.
          sql`tstzrange(${commitment.startsAt}, ${commitment.endsAt}, '[)') && tstzrange(${from.toISOString()}::timestamptz, ${to.toISOString()}::timestamptz, '[)')`
        )
      )
      .orderBy(asc(commitment.startsAt));
  } catch (error) {
    throw new Error(`Reading time failed: ${safeErrorReason(error)}`);
  }
}
