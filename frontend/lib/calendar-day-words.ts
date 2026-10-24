// Frontend: "Mon, Nov 16" for a calendar date, which has no zone of its own (the Calendar page), in
// the login's language (words.intlLocale).

export function calendarDayWords(date: string, intlLocale: string): string {
  return new Intl.DateTimeFormat(intlLocale, {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}
