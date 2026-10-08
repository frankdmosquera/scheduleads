// Shared: a moment's calendar date where the business is, as YYYY-MM-DD, not where the server or
// the browser is: at 11pm in Edmonton, UTC is already on tomorrow. Built from the date's parts,
// so no locale's own date order can change it. Used by the API and the customer's page.

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timezone, formatter);
  }
  return formatter;
}

export function localDate(moment: Date, timezone: string): string {
  const parts = formatterFor(timezone).formatToParts(moment);
  const part = (type: string) => parts.find((datePart) => datePart.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
