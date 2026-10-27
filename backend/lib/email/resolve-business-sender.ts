// Backend: which address a business's emails come from (feature 25a). In order: its own saved
// sender; else bookings@ the domain of its website, when that domain is set up in Resend; else
// bookings@booking-crm.com. Always in the business's name. The first two carry a fallback, the
// agency's address, for when Resend still refuses their domain.

import { hasResendSigningRecord } from "./has-resend-signing-record.js";
import { formatSender } from "./format-sender.js";

const AGENCY_SENDER = "bookings@booking-crm.com";

export type BusinessSenderType = {
  senderEmail: string; // the bare address
  from: string; // "Primo Painters" <bookings@primopainters.ca>
  fallbackFrom: string | null; // the agency's address in the business's name, or null when already it
  ownDomain: string | null; // the business's own sending domain, or null when it has none yet
};

// "https://www.primopainters.ca/contact" gives "primopainters.ca"; anything unreadable gives null.
function websiteDomain(website: string | null): string | null {
  if (!website) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

export async function resolveBusinessSender(input: {
  name: string;
  savedSender: string | null;
  website: string | null;
}): Promise<BusinessSenderType> {
  const domain = websiteDomain(input.website);
  const own =
    input.savedSender ||
    (domain && (await hasResendSigningRecord(domain)) ? `bookings@${domain}` : null);
  if (own) {
    return {
      senderEmail: own,
      from: formatSender(input.name, own),
      fallbackFrom: formatSender(input.name, AGENCY_SENDER),
      ownDomain: own.slice(own.lastIndexOf("@") + 1).toLowerCase(),
    };
  }
  return {
    senderEmail: AGENCY_SENDER,
    from: formatSender(input.name, AGENCY_SENDER),
    fallbackFrom: null,
    ownDomain: null,
  };
}
