// Booking component: a service's price as the window writes it (feature 25d), "$150" or
// "From $150", in the window's language; null when the service has none, so nothing is shown.

import { formatPrice } from "@scheduleads-app/shared/format-price";

import type { BookingServiceType } from "../../api-client/booking-api-types.js";
import type { BookingWordsType } from "../../words/booking-words-type.js";

export function priceText(
  price: BookingServiceType["price"],
  words: BookingWordsType
): string | null {
  if (!price) return null;
  const amount = formatPrice(price.cents, price.currency, words.language);
  return price.from ? words.priceFrom(amount) : amount;
}
