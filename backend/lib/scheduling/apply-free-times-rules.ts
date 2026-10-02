// Backend: the rules that turn one person's bookable hours and busy time into the start times a
// customer can take. No database, so every rule is tested; find-free-times.ts reads the rows.

import type { WeeklyHoursType } from "@scheduleads-app/shared/zod-validation";

import type { ResolvedBookableHoursType } from "../bookable-hours/apply-bookable-hours-rules.js";
import type { BusyBlockType } from "../calendar/calendar-provider.js";
import { addDays } from "../local-time/add-days.js";
import { localDate } from "../local-time/local-date.js";
import { localTimeToMoment } from "../local-time/local-time-to-moment.js";

export type FreeTimesServiceType = {
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  slotIntervalMinutes: number | null; // null = every durationMinutes
};

// A room the service can be done in: when it is taken, and the dates it is hidden from customers.
export type FreeTimesRoomType = { busy: BusyBlockType[]; standbyDates: string[] };

export type FreeTimesInputType = {
  hours: ResolvedBookableHoursType; // the person's, from resolveBookableHours
  service: FreeTimesServiceType;
  busy: BusyBlockType[]; // bookings, time off and Google, in any order
  standbyDates: string[]; // YYYY-MM-DD, hidden from customers on these dates
  rooms: FreeTimesRoomType[] | null; // null = no room check; [] = a room is needed and none can be used
  fromDate: string; // YYYY-MM-DD in the business's zone, included
  toDate: string; // YYYY-MM-DD in the business's zone, included
  now: Date; // a parameter, not new Date() inside, so notice and the horizon can be tested
};

const MINUTE_MS = 60_000;
const WEEKDAYS: (keyof WeeklyHoursType)[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function weekdayOf(date: string): keyof WeeklyHoursType {
  const [year, month, day] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

// Half-open, like the commitments rule: busy time ending at 10:00 leaves a 10:00 start free.
const overlapsAny = (busy: BusyBlockType[], start: number, end: number) =>
  busy.some((block) => block.start.getTime() < end && block.end.getTime() > start);

export function applyFreeTimesRules(input: FreeTimesInputType): Date[] {
  const { hours, service, busy, standbyDates, rooms, now } = input;
  const today = localDate(now, hours.timezone);
  const firstDate = input.fromDate > today ? input.fromDate : today; // YYYY-MM-DD sorts as text
  const horizonEnd = addDays(today, hours.horizonDays);
  const lastDate = input.toDate < horizonEnd ? input.toDate : horizonEnd;
  const earliest = now.getTime() + hours.minimumNoticeMinutes * MINUTE_MS;
  const step = service.slotIntervalMinutes ?? service.durationMinutes;
  const closed = new Set(hours.closedDates);
  const standby = new Set(standbyDates);

  const starts = new Set<number>();
  for (let date = firstDate; date <= lastDate; date = addDays(date, 1)) {
    if (closed.has(date) || standby.has(date)) continue;

    // A one-off date replaces that day's week.
    const windows =
      hours.dateHours.find((entry) => entry.date === date)?.windows ??
      hours.weeklyHours[weekdayOf(date)] ??
      [];

    for (const window of windows) {
      // The window's end as a real moment, so the spring change cannot stretch an appointment past
      // it; null when the end itself is the skipped hour, and then the clock count alone decides.
      const windowEnd = localTimeToMoment(date, window.endMinute, hours.timezone)?.getTime();

      // Only the appointment has to fit inside the window; its buffers may run past it (decision 1).
      for (
        let minute = window.startMinute;
        minute + service.durationMinutes <= window.endMinute;
        minute += step
      ) {
        const start = localTimeToMoment(date, minute, hours.timezone)?.getTime();
        if (start === undefined || start < earliest) continue;
        if (windowEnd !== undefined && start + service.durationMinutes * MINUTE_MS > windowEnd) {
          continue;
        }

        // The appointment and both its buffers must be clear, for the person and for one room.
        const spanStart = start - service.bufferBeforeMinutes * MINUTE_MS;
        const spanEnd = start + (service.durationMinutes + service.bufferAfterMinutes) * MINUTE_MS;
        if (overlapsAny(busy, spanStart, spanEnd)) continue;
        if (
          rooms !== null &&
          !rooms.some(
            (room) =>
              !room.standbyDates.includes(date) && !overlapsAny(room.busy, spanStart, spanEnd)
          )
        ) {
          continue;
        }

        starts.add(start);
      }
    }
  }

  return [...starts].sort((a, b) => a - b).map((start) => new Date(start));
}
