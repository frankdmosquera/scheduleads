// Backend: which address a business's emails come from (feature 25a). Only ever its website's
// domain, and only once that domain is set up in Resend (F-531: an owner can never send as
// another business's domain through the agency's key): its own saved sender when it is at that
// domain, else bookings@ that domain. Otherwise bookings@booking-crm.com. Always in the business's
// name. An own-domain sender carries a fallback, the agency's address, for when Resend still
// refuses the domain.

import { formatSender } from "./format-sender.js";
import { hasResendSigningRecord } from "./has-resend-signing-record.js";
import { websiteDomain } from "./website-domain.js";

const AGENCY_SENDER = "bookings@booking-crm.com";

export type BusinessSenderType = {
  senderEmail: string; // the bare address
  from: string; // "Primo Painters" <bookings@primopainters.ca>
  fallbackFrom: string | null; // the agency's address in the business's name, or null when already it
  ownDomain: string | null; // the business's own sending domain, or null when it has none yet
};

export async function resolveBusinessSender(input: {
  name: string;
  savedSender: string | null;
  website: string | null;
}): Promise<BusinessSenderType> {
  const domain = websiteDomain(input.website);
  if (domain && (await hasResendSigningRecord(domain))) {
    const saved = input.savedSender?.toLowerCase() ?? null;
    const own = saved && saved.endsWith(`@${domain}`) ? saved : `bookings@${domain}`;
    return {
      senderEmail: own,
      from: formatSender(input.name, own),
      fallbackFrom: formatSender(input.name, AGENCY_SENDER),
      ownDomain: domain,
    };
  }
  return {
    senderEmail: AGENCY_SENDER,
    from: formatSender(input.name, AGENCY_SENDER),
    fallbackFrom: null,
    ownDomain: null,
  };
}
