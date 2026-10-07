// Backend: the customer's confirmation text, under the business's name and never the product's:
// only what is needed, the time and the link to the booking's own page for everything else, so it
// fits one piece (feature 8b, decision 4).

import { formatTextTime } from "./format-text-time.js";
import { plainText } from "./plain-text.js";

export type BookingTextFactsType = {
  businessName: string;
  startsAt: Date;
  timezone: string;
  bookingPageUrl: string;
};

export function renderConfirmationText(facts: BookingTextFactsType): string {
  const when = formatTextTime(facts.startsAt, facts.timezone);
  return plainText(
    `${facts.businessName}: booked ${when}. Details or changes: ${facts.bookingPageUrl}`
  );
}
