// Backend: what the owner's "Email sending" card shows (feature 25a): the two saved addresses,
// both optional, and what is in use right now: the address the emails come from, picked by the
// same rule the emails use, and where the notices go.

import { findBusinessEmailDetails } from "./find-business-email-details.js";
import { resolveBusinessSender } from "./resolve-business-sender.js";

export type EmailSendingStateType = {
  senderEmail: string | null; // its own saved sender, or null for the one picked for it
  notifyEmail: string | null; // its saved notification address, or null for the owner's
  sendingFrom: string; // the address in use now
  fromOwnDomain: boolean; // false while it goes from booking-crm.com
  noticesTo: string | null; // where the notices go now; null when it has no owner either
};

export async function findEmailSendingState(
  organizationId: string
): Promise<EmailSendingStateType> {
  const business = await findBusinessEmailDetails(organizationId);
  if (!business) throw new Error("Reading email sending failed: the business does not exist.");
  const sender = await resolveBusinessSender({
    name: business.name,
    savedSender: business.senderEmail,
    website: business.website,
  });
  return {
    senderEmail: business.senderEmail,
    notifyEmail: business.notifyEmail,
    sendingFrom: sender.senderEmail,
    fromOwnDomain: sender.ownDomain !== null,
    noticesTo: business.notifyEmail ?? business.ownerEmail,
  };
}
