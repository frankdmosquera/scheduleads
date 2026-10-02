// Backend: a business's own calendar dates and clock times, turned into exact moments and back.
// Every rule about bookable time is written in the business's clock; the database and Google
// speak in exact moments. No database here.

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

// The business's clock at that moment, read back as if it were UTC, so two clocks compare as numbers.
function clockAsUtc(moment: number, timezone: string): number {
  const parts = formatterFor(timezone).formatToParts(new Date(moment));
  const part = (type: string) => Number(parts.find((datePart) => datePart.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
}

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

// Today's date where the business is, not where the server is: at 11pm in Edmonton the server in
// UTC is already on tomorrow.
export function localDate(moment: Date, timezone: string): string {
  return new Date(clockAsUtc(moment.getTime(), timezone)).toISOString().slice(0, 10);
}

// Calendar arithmetic on a plain YYYY-MM-DD, done in UTC so no daylight change can shift it.
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// The moment a business's clock shows `minuteOfDay` on `date`. null when that time does not exist
// (the hour skipped in spring); the first of the two when it happens twice (the autumn hour).
export function localTimeToMoment(
  date: string,
  minuteOfDay: number,
  timezone: string
): Date | null {
  const [year, month, day] = date.split("-").map(Number);
  const wanted = Date.UTC(year, month - 1, day) + minuteOfDay * MINUTE_MS;

  // A zone changes its offset at most once a day, so the offsets a day either side are the only
  // two this clock time can have.
  const candidates = [wanted - DAY_MS, wanted + DAY_MS]
    .map((probe) => wanted - (clockAsUtc(probe, timezone) - probe))
    .filter((moment) => clockAsUtc(moment, timezone) === wanted)
    .sort((a, b) => a - b);

  return candidates.length ? new Date(candidates[0]) : null;
}
