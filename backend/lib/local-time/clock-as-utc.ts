// Backend: what a business's clock shows at a moment, read back as if it were UTC, so a clock
// time and a moment can be compared as plain numbers. The base of every local-time helper.

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    formatters.set(timezone, formatter);
  }
  return formatter;
}

export function clockAsUtc(moment: number, timezone: string): number {
  const parts = formatterFor(timezone).formatToParts(new Date(moment));
  const part = (type: string) => Number(parts.find((datePart) => datePart.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
}
