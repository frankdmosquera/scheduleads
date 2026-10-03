// Backend: what the owner's "Email sending" card shows: the two addresses and when the key was
// saved. Never the key itself, not even locked (decision 6).

import { eq } from "drizzle-orm";

import { emailSendingKey, organization } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export type EmailSendingStateType = {
  senderEmail: string | null;
  notifyEmail: string | null;
  keySavedAt: string | null; // ISO 8601, or null when no key is saved
};

export async function findEmailSendingState(
  organizationId: string
): Promise<EmailSendingStateType> {
  const [row] = await db
    .select({
      senderEmail: organization.senderEmail,
      notifyEmail: organization.notifyEmail,
      keySavedAt: emailSendingKey.savedAt,
    })
    .from(organization)
    .leftJoin(emailSendingKey, eq(emailSendingKey.organizationId, organization.id))
    .where(eq(organization.id, organizationId))
    .limit(1);
  if (!row) throw new Error("Reading email sending failed: the business does not exist.");
  return { ...row, keySavedAt: row.keySavedAt?.toISOString() ?? null };
}
