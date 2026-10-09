// Booking component: a start time on the business's clock, "9:30 a.m.", as the emails and the
// customer's own page say it.

export function formatTimeOfDay(startsAt: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, hour: "numeric", minute: "2-digit" }).format(
    new Date(startsAt)
  );
}
