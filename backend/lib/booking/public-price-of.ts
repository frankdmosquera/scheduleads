// Backend: a service's price as the booking window gets it (feature 25d): none when the service
// has no amount or the business no currency, so a price is never shown without its currency.

export type PublicPriceType = { cents: number; from: boolean; currency: string } | null;

export function publicPriceOf(
  priceCents: number | null,
  priceFrom: boolean,
  currency: string | null
): PublicPriceType {
  if (priceCents === null || currency === null) return null;
  return { cents: priceCents, from: priceFrom, currency };
}
