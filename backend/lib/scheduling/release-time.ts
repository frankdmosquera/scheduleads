// Backend: gives held time back. The rows are kept, marked cancelled, and stop blocking. Only
// the business's own rows are touched; answers how many changed.

import { and, eq, inArray } from "drizzle-orm";

import { commitment } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import type { DatabaseExecutorType } from "../../database-executor-type.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";

export async function releaseTime(
  organizationId: string,
  ids: string[],
  executor: DatabaseExecutorType = db
): Promise<number> {
  if (ids.length === 0) return 0;

  try {
    const released = await executor
      .update(commitment)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(commitment.organizationId, organizationId),
          inArray(commitment.id, ids),
          eq(commitment.status, "active")
        )
      )
      .returning({ id: commitment.id });
    return released.length;
  } catch (error) {
    throw new Error(`Releasing time failed: ${safeErrorReason(error)}`);
  }
}
