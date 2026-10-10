// Backend: a lead the owner types in by hand. The contact by the rule bookings use (a known email
// is that person, their name and phone kept), the lead in the first stage, and "Added by hand" on
// their timeline, all together or not at all. The same form saved twice gives back the first lead.

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { lead } from "@scheduleads-app/shared/db";
import {
  addLeadValidationSchema,
  type AddLeadInputType,
} from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";
import { findFirstPipelineStage } from "./find-first-pipeline-stage.js";
import { findOrCreateContact } from "./find-or-create-contact.js";
import { recordActivity } from "./record-activity.js";

export type AddedLeadType = {
  leadId: string;
  contactId: string;
  joinedExistingContact: boolean; // the email was already a contact of this business
  repeated: boolean; // this form had already saved it
};

// Thrown inside the transaction when another save of the same form won, so its rows roll back.
class SameFormSavedError extends Error {}

export async function addLeadByHand(
  organizationId: string,
  actorUserId: string,
  input: AddLeadInputType
): Promise<AddedLeadType> {
  const { requestKey, name, phone, email, details } = addLeadValidationSchema.parse(input);

  const first = await findLeadOfForm(organizationId, requestKey);
  if (first) return { ...first, joinedExistingContact: false, repeated: true };

  const stage = await findFirstPipelineStage(organizationId);
  if (!stage) throw new Error("Adding a lead failed: the business has no pipeline stage.");

  try {
    return await db.transaction(async (tx) => {
      const { contact, created } = await findOrCreateContact(
        organizationId,
        { name, email: email || undefined, phone: phone || undefined },
        tx
      );
      const leadId = randomUUID();
      const [added] = await tx
        .insert(lead)
        .values({
          id: leadId,
          organizationId,
          contactId: contact.id,
          stageId: stage.id,
          source: "manual",
          details: details || null,
          phone: phone || null,
          requestKey,
        })
        .onConflictDoNothing() // the request key's index: the same form saved at the same instant
        .returning({ id: lead.id });
      if (!added) throw new SameFormSavedError();

      await recordActivity(
        organizationId,
        { contactId: contact.id, type: "lead_added", payload: { leadId }, actorUserId },
        tx
      );
      return { leadId, contactId: contact.id, joinedExistingContact: !created, repeated: false };
    });
  } catch (error) {
    if (error instanceof SameFormSavedError) {
      const winner = await findLeadOfForm(organizationId, requestKey);
      if (winner) return { ...winner, joinedExistingContact: false, repeated: true };
    }
    // Never the database's own error: its message carries the query, the customer's details in it.
    throw new Error(`Adding a lead failed: ${safeErrorReason(error)}`);
  }
}

async function findLeadOfForm(
  organizationId: string,
  requestKey: string
): Promise<{ leadId: string; contactId: string } | null> {
  const [found] = await db
    .select({ leadId: lead.id, contactId: lead.contactId })
    .from(lead)
    .where(and(eq(lead.organizationId, organizationId), eq(lead.requestKey, requestKey)))
    .limit(1);
  return found ?? null;
}
