// Booking component: a date as a day button says it, "Wednesday, October 14". The date is already
// the business's, so it is read in UTC and no zone can move it.

const dayNameFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
});

export function formatDayName(date: string): string {
  return dayNameFormat.format(new Date(`${date}T00:00:00Z`));
}
