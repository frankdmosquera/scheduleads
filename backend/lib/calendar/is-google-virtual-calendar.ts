// Backend: Google's own built-in calendars (holidays, contacts' birthdays) live under
// group.v.calendar.google.com. Free/busy answers notFound for them, and they hold no busy time,
// so they are never offered as a pick and never asked about (found on 12b.1's hand check).

export function isGoogleVirtualCalendar(calendarId: string): boolean {
  return calendarId.endsWith("@group.v.calendar.google.com");
}
