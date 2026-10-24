// Frontend component: the Calendar's Day and Week views as a time grid: hours down the side, one
// column per day, the online booking hours shaded, and bookings, time off and Google busy times as
// blocks at their times in the business's zone.

"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  ScheduleDayType,
  ScheduleItemType,
} from "@/lib/api-client/schedule/fetch-schedule-week";
import { removeTimeOff } from "@/lib/api-client/schedule/remove-time-off";
import { calendarDayWords } from "@/lib/calendar-day-words";
import { minutesOnDay } from "@/lib/calendar-dates";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";
import type { DashboardWordsType } from "@/lib/dashboard-words/dashboard-words-type";

const HOUR_HEIGHT = 48; // px for one hour of the grid

export const KIND_STYLES: Record<ScheduleItemType["kind"], string> = {
  booking: "border-[var(--primary)] bg-[var(--accent-soft)]",
  time_off: "border-[var(--wait)] bg-[var(--wait-soft)]",
  google_busy: "border-border bg-muted",
};

// "8:00 a.m." for a minute of the day.
export function clockWords(minuteOfDay: number, words: DashboardWordsType): string {
  if (minuteOfDay === 1440) return words.scheduleWords.midnight;
  return new Intl.DateTimeFormat(words.intlLocale, {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(Date.UTC(2000, 0, 1, 0, minuteOfDay)));
}

// The hours the grid shows: every bookable hour and every item, 8 a.m. to 6 p.m. at the least.
function hoursShown(days: ScheduleDayType[], timezone: string): { first: number; last: number } {
  let first = 8 * 60;
  let last = 18 * 60;
  for (const day of days) {
    for (const window of day.hours) {
      first = Math.min(first, window.startMinute);
      last = Math.max(last, window.endMinute);
    }
    for (const item of day.items) {
      const { start, end } = minutesOnDay(item, day.date, timezone);
      first = Math.min(first, start);
      last = Math.max(last, end);
    }
  }
  return { first: Math.floor(first / 60), last: Math.ceil(last / 60) };
}

// Side by side when they overlap: each item gets a lane, and each run of overlapping items shares
// the day's width between as many lanes as it needs; an item alone keeps the whole width.
function lanesOf(spans: { start: number; end: number }[]): { lane: number; lanes: number }[] {
  const order = spans.map((_, index) => index).sort((a, b) => spans[a].start - spans[b].start);
  const placed: { lane: number; lanes: number }[] = [];
  let run: number[] = [];
  let laneEnds: number[] = [];
  let runEnd = -1;
  const closeRun = () => {
    for (const index of run) placed[index].lanes = laneEnds.length;
    run = [];
    laneEnds = [];
  };
  for (const index of order) {
    if (spans[index].start >= runEnd) closeRun();
    const free = laneEnds.findIndex((end) => end <= spans[index].start);
    const lane = free === -1 ? laneEnds.length : free;
    laneEnds[lane] = spans[index].end;
    placed[index] = { lane, lanes: 1 };
    run.push(index);
    runEnd = Math.max(runEnd, spans[index].end);
  }
  closeRun();
  return placed;
}

// "9 a.m." for an hour down the grid's side.
function hourWords(hour: number, intlLocale: string): string {
  return new Intl.DateTimeFormat(intlLocale, { timeZone: "UTC", hour: "numeric" }).format(
    new Date(Date.UTC(2000, 0, 1, hour))
  );
}

export function ScheduleTimeGrid({
  days,
  today,
  timezone,
  canEdit,
  onChanged,
}: {
  days: ScheduleDayType[];
  today: string;
  timezone: string;
  canEdit: boolean;
  onChanged: () => void; // the calendar reads again
}) {
  const { words } = useDashboardWords();
  const scheduleWords = words.scheduleWords;
  const [refusal, setRefusal] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const { first, last } = hoursShown(days, timezone);
  const height = (last - first) * HOUR_HEIGHT;
  const top = (minute: number) => ((minute - first * 60) / 60) * HOUR_HEIGHT;
  const hours = Array.from({ length: last - first }, (_, index) => first + index);

  async function remove(timeOffId: string) {
    setRefusal(null);
    setRemoving(timeOffId);
    const removed = await removeTimeOff(timeOffId);
    setRemoving(null);
    if (removed.state === "ok") onChanged();
    else setRefusal(removed.message);
  }

  return (
    <div>
      {refusal ? (
        <p role="alert" className="mb-2 text-sm text-[var(--lost)]">
          {refusal}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `4rem repeat(${days.length}, minmax(${days.length > 1 ? "6.5rem" : "12rem"}, 1fr))`,
          }}
        >
          <div className="border-b border-border" />
          {days.map((day) => (
            <div
              key={day.date}
              className={`border-b border-l border-border px-2 py-2 ${day.date === today ? "bg-[var(--accent-soft)]" : ""}`}
            >
              <h2
                aria-current={day.date === today ? "date" : undefined}
                className="text-sm font-semibold text-foreground aria-[current=date]:text-[var(--primary)]"
              >
                {calendarDayWords(day.date, words.intlLocale)}
              </h2>
              {day.closed || day.standby || day.hours.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {day.closed
                    ? scheduleWords.closed
                    : day.standby
                      ? scheduleWords.onStandby
                      : scheduleWords.noBookableHours}
                </p>
              ) : null}
            </div>
          ))}

          <div className="relative" style={{ height }}>
            {hours.map((hour) => (
              <span
                key={hour}
                className="absolute right-2 -translate-y-1/2 whitespace-nowrap text-[11px] text-muted-foreground first:translate-y-0"
                style={{ top: top(hour * 60) }}
              >
                {hourWords(hour, words.intlLocale)}
              </span>
            ))}
          </div>
          {days.map((day) => {
            const spans = day.items.map((item) => minutesOnDay(item, day.date, timezone));
            const lanes = lanesOf(spans);
            return (
              <ul
                key={day.date}
                aria-label={calendarDayWords(day.date, words.intlLocale)}
                className="relative border-l border-border"
                style={{ height }}
              >
                {hours.map((hour) => (
                  <li
                    key={hour}
                    aria-hidden
                    className="absolute inset-x-0 border-t border-border/60"
                    style={{ top: top(hour * 60) }}
                  />
                ))}
                {day.hours.map((window) => (
                  <li
                    key={window.startMinute}
                    aria-hidden
                    className="absolute inset-x-0 bg-[var(--info-soft)]"
                    style={{
                      top: top(window.startMinute),
                      height: top(window.endMinute) - top(window.startMinute),
                    }}
                  />
                ))}
                {day.items.map((item, index) => {
                  const span = spans[index];
                  const { lane, lanes: count } = lanes[index];
                  return (
                    <li
                      key={`${item.kind}-${item.startsAt}-${index}`}
                      title={`${clockWords(span.start, words)}–${clockWords(span.end, words)} · ${
                        item.kind === "booking"
                          ? `${item.booking.customerName} · ${item.booking.serviceName}`
                          : item.kind === "time_off"
                            ? scheduleWords.timeOff
                            : scheduleWords.busyInGoogle
                      }`}
                      className={`absolute overflow-hidden rounded-md border px-1.5 py-1 text-[11px] leading-tight ${KIND_STYLES[item.kind]}`}
                      style={{
                        top: top(span.start) + 1,
                        height: Math.max(top(span.end) - top(span.start) - 2, 18),
                        left: `calc(${(lane / count) * 100}% + 2px)`,
                        width: `calc(${100 / count}% - 4px)`,
                      }}
                    >
                      {/* First line: when and who, readable even in a half-hour block; the rest below it. */}
                      <p className="truncate text-foreground">
                        <span className="font-medium">{clockWords(span.start, words)}</span>{" "}
                        {item.kind === "booking" ? (
                          <Link
                            href={`/leads/${item.booking.leadId}`}
                            className="underline underline-offset-2"
                          >
                            {item.booking.customerName}
                          </Link>
                        ) : item.kind === "time_off" ? (
                          scheduleWords.timeOff
                        ) : (
                          scheduleWords.busyInGoogle
                        )}
                      </p>
                      {item.kind === "booking" ? (
                        <p className="text-muted-foreground">
                          {clockWords(span.start, words)}–{clockWords(span.end, words)} &middot;{" "}
                          {item.booking.serviceName}
                          {item.booking.placeName ? ` · ${item.booking.placeName}` : ""}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">
                          {clockWords(span.start, words)}–{clockWords(span.end, words)}
                          {item.kind === "time_off" && canEdit ? (
                            <>
                              {" "}
                              &middot;{" "}
                              <button
                                type="button"
                                onClick={() => remove(item.id)}
                                disabled={removing !== null}
                                className="underline underline-offset-2"
                              >
                                {removing === item.id
                                  ? scheduleWords.removing
                                  : scheduleWords.remove}
                              </button>
                            </>
                          ) : null}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            );
          })}
        </div>
      </div>
    </div>
  );
}
