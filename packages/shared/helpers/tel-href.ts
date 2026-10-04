// Shared: a phone as typed, "(403) 555-0148", as the link a phone dials, "tel:4035550148".
// Used by the customer's page and the emails.

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
