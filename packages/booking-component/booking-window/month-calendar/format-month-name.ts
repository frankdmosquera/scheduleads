// Booking component: a month as the calendar's heading says it, "October 2026".

const monthNameFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

export function formatMonthName(month: string): string {
  return monthNameFormat.format(new Date(`${month}-01T00:00:00Z`));
}
