// Backend: a next step the owner owes the person behind a lead ("call back Thursday"). Kept on
// the contact's queue as a task with a due date, read in the business's time zone (the browser's
// when the business has none yet, as the page shows it).

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { activity, lead } from "@scheduleads-app/shared/db";
import {
  nextStepValidationSchema,
  type NextStepInputType,
} from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";
import { localTimeToMoment } from "../local-time/local-time-to-moment.js";
import { findBusinessTimeZone } from "./find-business-time-zone.js";

export type AddNextStepResultType =
  | { state: "ok"; id: string }
  | { state: "not-found" } // no such lead in this business
  | { state: "no-such-time" }; // the hour the clocks skip in spring

export async function addNextStep(
  organizationId: string,
  leadId: string,
  actorUserId: string,
  input: NextStepInputType
): Promise<AddNextStepResultType> {
  const { what, dueLocal, browserTimeZone } = nextStepValidationSchema.parse(input);

  const [owner] = await db
    .select({ contactId: lead.contactId })
    .from(lead)
    .where(and(eq(lead.organizationId, organizationId), eq(lead.id, leadId)))
    .limit(1);
  if (!owner) return { state: "not-found" };

  const [date, time] = dueLocal.split("T");
  const [hours, minutes] = time.split(":").map(Number);
  const zone = (await findBusinessTimeZone(organizationId)) ?? browserTimeZone;
  const dueAt = localTimeToMoment(date, hours * 60 + minutes, zone);
  if (!dueAt) return { state: "no-such-time" };

  const id = randomUUID();
  try {
    await db.insert(activity).values({
      id,
      organizationId,
      contactId: owner.contactId,
      type: "task",
      payload: { what, leadId },
      actorUserId,
      dueAt,
    });
  } catch (error) {
    // Never the database's own error: its message carries the query, and `what` can hold a
    // customer's details.
    throw new Error(`Adding a next step failed: ${safeErrorReason(error)}`);
  }
  return { state: "ok", id };
}
