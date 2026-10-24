// Frontend: a time on the leads screens, short: "Wed, Oct 23, 2:00 p.m.", in the login's language
// (words.intlLocale). In the business's own zone when it has one; otherwise the browser's, and the
// screen says so.

export function formatLeadTime(iso: string, timeZone: string | null, intlLocale: string): string {
  return new Intl.DateTimeFormat(intlLocale, {
    timeZone: timeZone ?? undefined,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
