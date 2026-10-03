// Backend: a business's own Resend key, pasted by its owner (step 6.3): proved with a test email
// from the business's address, then kept locked. A refused key keeps nothing, and the earlier
// key, if any, stays in use.

import { checkEmailSendingKey } from "./check-email-sending-key.js";
import { findBusinessEmailDetails } from "./find-business-email-details.js";
import { storeEmailSendingKey } from "./store-email-sending-key.js";

export type SaveEmailSendingKeyResultType =
  { ok: true; savedAt: Date } | { ok: false; reason: string };

export async function saveEmailSendingKey(
  organizationId: string,
  apiKey: string
): Promise<SaveEmailSendingKeyResultType> {
  const business = await findBusinessEmailDetails(organizationId);
  if (!business) throw new Error("Saving an email key failed: the business does not exist.");
  if (!business.senderEmail || !business.notifyEmail) {
    return {
      ok: false,
      reason: "Set the address emails come from and where notifications go first.",
    };
  }

  const checked = await checkEmailSendingKey({
    apiKey,
    businessName: business.name,
    senderEmail: business.senderEmail,
    notifyEmail: business.notifyEmail,
  });
  if (!checked.ok) return checked;
  return { ok: true, ...(await storeEmailSendingKey(organizationId, apiKey)) };
}
