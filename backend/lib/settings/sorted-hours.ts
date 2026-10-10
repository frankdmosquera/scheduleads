// Backend: hours as they are stored: each day's windows by start, one-off dates by date.

import type { DateHoursType, WeeklyHoursType } from "@scheduleads-app/shared/zod-validation";

type HoursType<Week> = { weeklyHours: Week; dateHours: DateHoursType };

const byStart = (a: { startMinute: number }, b: { startMinute: number }) =>
  a.startMinute - b.startMinute;

// The editor appends windows where the owner adds them; the stored row reads in order.
export function sortedHours<Week extends WeeklyHoursType | null>(
  hours: HoursType<Week>
): HoursType<Week> {
  const weeklyHours =
    hours.weeklyHours === null
      ? hours.weeklyHours
      : (Object.fromEntries(
          Object.entries(hours.weeklyHours).map(([day, windows]) => [
            day,
            [...(windows ?? [])].sort(byStart),
          ])
        ) as Week);
  const dateHours = hours.dateHours
    .map((entry) => ({ date: entry.date, windows: [...entry.windows].sort(byStart) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { weeklyHours, dateHours };
}
