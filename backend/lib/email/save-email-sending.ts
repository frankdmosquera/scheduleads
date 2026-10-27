// Backend: saves the owner's "Email sending" card (feature 25a): the address the emails come
// from and where the notices go, each optional; empty is saved as nothing, which means "pick it
// for me" and "my login email". No key and no test email: the agency's key sends. A sender must
// be at the business's own website domain (F-531), the only domain its emails may come from.

import { eq } from "drizzle-orm";

import { organization } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { findEmailSendingState, type EmailSendingStateType } from "./find-email-sending-state.js";
import { websiteDomain } from "./website-domain.js";

export type SaveEmailSendingInputType = {
  senderEmail: string; // "" for none
  notifyEmail: string; // "" for none
};

export type SaveEmailSendingResultType =
  { ok: true; state: EmailSendingStateType } | { ok: false; reason: string };

export async function saveEmailSending(
  organizationId: string,
  input: SaveEmailSendingInputType
): Promise<SaveEmailSendingResultType> {
  const [business] = await db
    .select({ website: organization.website })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  if (!business) throw new Error("Saving email sending failed: the business does not exist.");

  const sender = input.senderEmail.toLowerCase();
  if (sender) {
    const domain = websiteDomain(business.website);
    if (!domain) {
      return {
        ok: false,
        reason: "Leave this empty for now: your website is not set up for your own address yet.",
      };
    }
    if (!sender.endsWith(`@${domain}`)) {
      return { ok: false, reason: `Use an address at ${domain}, your website's own domain.` };
    }
  }

  await db
    .update(organization)
    .set({ senderEmail: sender || null, notifyEmail: input.notifyEmail || null })
    .where(eq(organization.id, organizationId));
  return { ok: true, state: await findEmailSendingState(organizationId) };
}
