// Frontend: "Mon, Nov 16" for a calendar date, which has no zone of its own (the Calendar page).

export function calendarDayWords(date: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}
