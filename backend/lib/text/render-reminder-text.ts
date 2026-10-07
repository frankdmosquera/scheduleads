// Backend: the customer's reminder text, under the business's name and never the product's: only
// the time and the link to the booking's own page, so it fits one piece (feature 8b, decision 4).

import { fitBusinessName } from "./fit-business-name.js";
import { formatTextTime } from "./format-text-time.js";
import type { BookingTextFactsType } from "./render-confirmation-text.js";

export function renderReminderText(facts: BookingTextFactsType): string {
  const when = formatTextTime(facts.startsAt, facts.timezone);
  return fitBusinessName(
    facts.businessName,
    (name) => `${name} reminder: ${when}. Details or changes: ${facts.bookingPageUrl}`
  );
}
