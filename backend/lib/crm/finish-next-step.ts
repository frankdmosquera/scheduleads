// Backend: ticks a next step done. Only one owed to the person behind this lead, in this business;
// false when there is no such step, or it was already done.

import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { activity, lead } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";

export async function finishNextStep(
  organizationId: string,
  leadId: string,
  nextStepId: string
): Promise<boolean> {
  const [owner] = await db
    .select({ contactId: lead.contactId })
    .from(lead)
    .where(and(eq(lead.organizationId, organizationId), eq(lead.id, leadId)))
    .limit(1);
  if (!owner) return false;

  const done = await db
    .update(activity)
    .set({ doneAt: new Date() })
    .where(
      and(
        eq(activity.organizationId, organizationId),
        eq(activity.contactId, owner.contactId),
        eq(activity.id, nextStepId),
        isNotNull(activity.dueAt),
        isNull(activity.doneAt)
      )
    )
    .returning({ id: activity.id })
    .catch((error: unknown) => {
      // Never the database's own error: its message carries the query.
      throw new Error(`Finishing a next step failed: ${safeErrorReason(error)}`);
    });
  return done.length > 0;
}
