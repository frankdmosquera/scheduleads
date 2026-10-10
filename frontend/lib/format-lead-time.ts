// Frontend: a time on the leads screens, short: "Wed, Oct 23, 2:00 p.m.". In the business's own
// zone when it has one; otherwise the browser's, and the screen says so.

export function formatLeadTime(iso: string, timeZone: string | null): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone ?? undefined,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
