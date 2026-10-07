// Shared: a phone as typed, "(403) 555-0148", as the number Twilio texts, "+14035550148", or null
// when it cannot be one (feature 8b, decision 10). North American numbers only: every tenant is in
// Canada. Ten digits, or eleven starting with 1, the area code and the exchange each starting 2
// to 9, as every real one does.

const NORTH_AMERICAN = /^1?([2-9]\d{2}[2-9]\d{6})$/;

export function textablePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const typed = phone.trim();
  if (typed.startsWith("+") && !typed.startsWith("+1")) return null; // another country's code
  const match = NORTH_AMERICAN.exec(typed.replace(/\D/g, ""));
  return match ? `+1${match[1]}` : null;
}
