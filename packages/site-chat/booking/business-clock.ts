/*
 * The business's clock: its free times are offered, and its days named, in its own time zone, as the booking window
 * shows them. Calendar days travel as plain dates (midnight on this machine's clock, a key only) and as YYYY-MM-DD.
 */

/** A moment as the business's wall clock reads it; `month` counts from 0, as `Date` does. */
export function wallClock(
  at: Date,
  timeZone: string
): { year: number; month: number; date: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(at);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: part("year"),
    month: part("month") - 1,
    date: part("day"),
    minutes: part("hour") * 60 + part("minute"),
  };
}

/** Midnight of today on the business's clock, as a plain calendar day. */
export function todayIn(timeZone: string, now = new Date()): Date {
  const w = wallClock(now, timeZone);
  return new Date(w.year, w.month, w.date);
}

/** "2026-10-31", for a plain calendar day. */
export function isoDay(day: Date): string {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

/** The plain calendar day of "2026-10-31"; null when it is not a real date. */
export function dayOfIso(iso: string | null | undefined): Date | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return day.getMonth() === Number(m[2]) - 1 && day.getDate() === Number(m[3]) ? day : null;
}

/** "Saturday, October 31" for "2026-10-31", in `locale`, the same on every machine. */
export function dayName(iso: string, locale: string): string {
  const [year, month, date] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date, 12)).toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** The date `days` after `from`'s, as YYYY-MM-DD in UTC. */
export function utcDate(from: Date, days: number): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + days));
  return d.toISOString().slice(0, 10);
}
