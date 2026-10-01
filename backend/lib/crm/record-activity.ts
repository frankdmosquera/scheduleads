// Backend: records something that happened on a contact's timeline. Feature 5 calls it for
// "booking created". The contact must belong to the same business: the database refuses
// anything else.

import { randomUUID } from "node:crypto";

import type { ActivityTypeType } from "@scheduleads-app/shared/crm";
import { activity } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";

export type RecordActivityInputType = {
  contactId: string;
  type: ActivityTypeType;
  payload?: Record<string, unknown>;
  actorUserId?: string | null; // the login that did it; none when a customer or the system did
  occurredAt?: Date; // now, unless it happened earlier
};

export async function recordActivity(
  organizationId: string,
  {
    contactId,
    type,
    payload = {},
    actorUserId = null,
    occurredAt = new Date(),
  }: RecordActivityInputType
): Promise<{ id: string; occurredAt: Date }> {
  try {
    const [recorded] = await db
      .insert(activity)
      .values({
        id: randomUUID(),
        organizationId,
        contactId,
        type,
        payload,
        actorUserId,
        occurredAt,
      })
      .returning({ id: activity.id });
    return { id: recorded.id, occurredAt };
  } catch (error) {
    // Never the database's own error: its message carries the query, and a payload can hold a
    // customer's own words.
    throw new Error(`Recording an activity failed: ${safeErrorReason(error)}`);
  }
}
