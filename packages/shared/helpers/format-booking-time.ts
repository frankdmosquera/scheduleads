// Shared: a booking's time as the emails and the customer's page say it, in the business's own
// zone with the zone named: "Thursday, October 8 at 9:00 a.m. MDT". Never the server's or the
// browser's zone; Railway runs UTC.

export function formatBookingTime(moment: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(moment);
}
