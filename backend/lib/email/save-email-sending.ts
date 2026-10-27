// Backend: saves the owner's "Email sending" card (feature 25a): the address the emails come
// from and where the notices go, each optional; empty is saved as nothing, which means "pick it
// for me" and "my login email". No key and no test email: the agency's key sends.

import { eq } from "drizzle-orm";

import { organization } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { findEmailSendingState, type EmailSendingStateType } from "./find-email-sending-state.js";

export type SaveEmailSendingInputType = {
  senderEmail: string; // "" for none
  notifyEmail: string; // "" for none
};

export async function saveEmailSending(
  organizationId: string,
  input: SaveEmailSendingInputType
): Promise<EmailSendingStateType> {
  const updated = await db
    .update(organization)
    .set({ senderEmail: input.senderEmail || null, notifyEmail: input.notifyEmail || null })
    .where(eq(organization.id, organizationId))
    .returning({ id: organization.id });
  if (updated.length === 0) {
    throw new Error("Saving email sending failed: the business does not exist.");
  }
  return findEmailSendingState(organizationId);
}
