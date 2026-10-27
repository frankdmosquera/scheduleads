// Shared: a price as the customer reads it (feature 25d), "$150" or "$12.50", "$ 45.000" in
// Spanish: the currency's short symbol and no ".00" on a whole amount. The booking window and the
// emails both use it, so they never disagree. "From" is each one's own words.

// Spanish is written as the currency's own country writes it ("$ 45.000" in Colombia); plain "es"
// is Spain's, which puts the symbol last, so any other currency gets Latin America's.
const SPANISH_OF: Record<string, string> = { COP: "es-CO", MXN: "es-MX" };

export function formatPrice(cents: number, currency: string, language: "en" | "es"): string {
  const whole = cents % 100 === 0;
  const locale = language === "es" ? (SPANISH_OF[currency] ?? "es-419") : "en";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}
