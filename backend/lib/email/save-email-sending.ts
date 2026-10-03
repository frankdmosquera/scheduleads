// Backend: saves the owner's "Email sending" card (decision 9): the two addresses and, when one
// is pasted, a new key for the business's own Resend. With a key there, the new one or the one
// already saved, one test email goes from the new sender to the new notification address first;
// refused, nothing changes. The new key is only ever locked away, never read back out.

import { eq } from "drizzle-orm";

import { emailSendingKey, organization } from "@scheduleads-app/shared/db";
import { decryptCredentials, readTokenKey } from "@scheduleads-app/shared/crypto";

import { db } from "../../database.js";
import { checkEmailSendingKey, type EmailRefusalAboutType } from "./check-email-sending-key.js";
import { findEmailSendingState, type EmailSendingStateType } from "./find-email-sending-state.js";
import { storeEmailSendingKey } from "./store-email-sending-key.js";

export type SaveEmailSendingInputType = {
  senderEmail: string;
  notifyEmail: string;
  key: string | null; // a new key, or null to keep the one already saved
};

export type SaveEmailSendingResultType =
  | { ok: true; state: EmailSendingStateType }
  | { ok: false; reason: string; about: EmailRefusalAboutType };

// The key the test email goes with: the new one, else the saved one. A saved key that can no
// longer be opened (a changed token key) is asked for again rather than silently skipped.
async function keyToTest(
  organizationId: string,
  newKey: string | null
): Promise<string | null | "unreadable"> {
  if (newKey) return newKey;
  const [saved] = await db
    .select({ credentials: emailSendingKey.credentials })
    .from(emailSendingKey)
    .where(eq(emailSendingKey.organizationId, organizationId))
    .limit(1);
  if (!saved) return null;
  try {
    return decryptCredentials(saved.credentials, readTokenKey(), organizationId);
  } catch {
    return "unreadable";
  }
}

export async function saveEmailSending(
  organizationId: string,
  input: SaveEmailSendingInputType
): Promise<SaveEmailSendingResultType> {
  const [business] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  if (!business) throw new Error("Saving email sending failed: the business does not exist.");

  const apiKey = await keyToTest(organizationId, input.key);
  if (apiKey === "unreadable") {
    return {
      ok: false,
      reason: "The saved key can no longer be read. Paste it again.",
      about: "key",
    };
  }
  if (apiKey) {
    const checked = await checkEmailSendingKey({
      apiKey,
      businessName: business.name,
      senderEmail: input.senderEmail,
      notifyEmail: input.notifyEmail,
    });
    if (!checked.ok) return checked;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(organization)
      .set({ senderEmail: input.senderEmail, notifyEmail: input.notifyEmail })
      .where(eq(organization.id, organizationId));
    if (input.key) await storeEmailSendingKey(organizationId, input.key, tx);
  });
  return { ok: true, state: await findEmailSendingState(organizationId) };
}
