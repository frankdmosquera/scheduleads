// Frontend: the Calendar page's date sums. Calendar dates are plain YYYY-MM-DD and every sum is done in
// UTC, so no daylight change moves a day; a moment is placed in the business's own zone.

import { addDays } from "@scheduleads-app/shared/add-days";

export type CalendarViewType = "day" | "week" | "month";

const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 is Sunday

// The Monday of a date's week, the week the API is asked for.
export function mondayOf(date: string): string {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

export function firstOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function addMonths(date: string, months: number): string {
  const moved = new Date(`${firstOfMonth(date)}T12:00:00Z`);
  moved.setUTCMonth(moved.getUTCMonth() + months);
  return moved.toISOString().slice(0, 10);
}

// The Monday of every week that shows a day of the date's month: four to six of them.
export function weeksOfMonth(date: string): string[] {
  const nextMonth = addMonths(date, 1);
  const weeks: string[] = [];
  for (let monday = mondayOf(firstOfMonth(date)); monday < nextMonth; monday = addDays(monday, 7)) {
    weeks.push(monday);
  }
  return weeks;
}

// Where a moment falls in a zone: its date, and its minute of that day.
export function placeInZone(iso: string, timezone: string): { date: string; minute: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function todayInZone(timezone: string): string {
  return placeInZone(new Date().toISOString(), timezone).date;
}

// The minutes of a day an item covers, cut to that day when it starts before or ends after it.
export function minutesOnDay(
  item: { startsAt: string; endsAt: string },
  date: string,
  timezone: string
): { start: number; end: number } {
  const start = placeInZone(item.startsAt, timezone);
  const end = placeInZone(item.endsAt, timezone);
  return {
    start: start.date < date ? 0 : start.minute,
    end: end.date > date ? 1440 : end.minute,
  };
}
