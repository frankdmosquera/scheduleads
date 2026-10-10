// Backend: a next step the owner owes the person behind a lead ("call back Thursday"). Kept on
// the contact's queue as a task with a due date. Null when the lead is not this business's.

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { activity, lead } from "@scheduleads-app/shared/db";
import {
  nextStepValidationSchema,
  type NextStepInputType,
} from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";

export async function addNextStep(
  organizationId: string,
  leadId: string,
  actorUserId: string,
  input: NextStepInputType
): Promise<{ id: string } | null> {
  const { what, dueAt } = nextStepValidationSchema.parse(input);

  const [owner] = await db
    .select({ contactId: lead.contactId })
    .from(lead)
    .where(and(eq(lead.organizationId, organizationId), eq(lead.id, leadId)))
    .limit(1);
  if (!owner) return null;

  const id = randomUUID();
  await db.insert(activity).values({
    id,
    organizationId,
    contactId: owner.contactId,
    type: "task",
    payload: { what, leadId },
    actorUserId,
    dueAt: new Date(dueAt),
  });
  return { id };
}
