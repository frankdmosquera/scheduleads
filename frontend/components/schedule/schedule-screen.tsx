// Frontend component: the Calendar page (feature 12b): one person's or place's week, Monday to
// Sunday in the business's time zone: the bookable hours, closed days, bookings, time off and
// Google busy times. Logic first; the final look comes in a later pass.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { addDays } from "@scheduleads-app/shared/add-days";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { RefusalNotice } from "@/components/centred-card/refusal-notice";
import { Button } from "@/components/ui/button";
import {
  fetchScheduleWeek,
  type ScheduleDayType,
  type ScheduleItemType,
  type ScheduleWeekResultType,
  type ScheduleWeekType,
} from "@/lib/api-client/schedule/fetch-schedule-week";

// "Mon, Nov 16" for a calendar date, which has no zone of its own.
function dayWords(date: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

// "8:00 a.m." for a minute of the day.
function clockWords(minuteOfDay: number): string {
  if (minuteOfDay === 1440) return "midnight";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(Date.UTC(2000, 0, 1, 0, minuteOfDay)));
}

// An item's time in the business's zone, its date too when it does not start on this day.
function itemTime(iso: string, timezone: string, day: string): string {
  const moment = new Date(iso);
  const sameDay = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(moment) === day; // YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    ...(sameDay ? {} : { weekday: "short", month: "short", day: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  }).format(moment);
}

const KIND_STYLES: Record<ScheduleItemType["kind"], string> = {
  booking: "border-[var(--primary)] bg-[var(--accent-soft)]",
  time_off: "border-[var(--wait)] bg-[var(--wait-soft)]",
  google_busy: "border-border bg-muted",
};

export function ScheduleScreen() {
  const [asked, setAsked] = useState<{ resourceId?: string; weekOf?: string }>({});
  const [result, setResult] = useState<ScheduleWeekResultType | null>(null);
  const [attempt, setAttempt] = useState(0); // Try again asks once more

  useEffect(() => {
    // `live` stops a late answer from updating a page the user already left.
    let live = true;
    fetchScheduleWeek(asked).then((next) => {
      if (live) setResult(next);
    });
    return () => {
      live = false;
    };
  }, [asked, attempt]);

  const ask = (next: { resourceId?: string; weekOf?: string }) => {
    setResult(null);
    setAsked(next);
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Calendar</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Each person&apos;s and place&apos;s week: bookings, time off and their Google busy times,
        over the hours customers can book.
      </p>

      <div className="mt-6">
        {!result ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : result.state === "signed-out" || result.state === "refused" ? (
          <RefusalNotice refusal={result} />
        ) : result.state === "unreachable" ? (
          <div className="flex flex-col items-start gap-3">
            <CentredCardNotice>{result.message}</CentredCardNotice>
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setAttempt((count) => count + 1);
              }}
            >
              Try again
            </Button>
          </div>
        ) : (
          <ScheduleWeek week={result.week} onAsk={ask} />
        )}
      </div>
    </div>
  );
}

function ScheduleWeek({
  week,
  onAsk,
}: {
  week: ScheduleWeekType;
  onAsk: (next: { resourceId?: string; weekOf?: string }) => void;
}) {
  const resourceId = week.resource.id;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {week.resources.length > 1 ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Calendar of</span>
            <select
              value={resourceId}
              onChange={(event) => onAsk({ resourceId: event.target.value, weekOf: week.weekOf })}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {week.resources.map((one) => (
                <option key={one.id} value={one.id}>
                  {one.name}
                  {one.kind === "place" ? " (place)" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-sm font-medium text-foreground">{week.resource.name}</p>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAsk({ resourceId, weekOf: addDays(week.weekOf, -7) })}
          >
            Previous week
          </Button>
          <Button variant="outline" size="sm" onClick={() => onAsk({ resourceId })}>
            This week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAsk({ resourceId, weekOf: addDays(week.weekOf, 7) })}
          >
            Next week
          </Button>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        Week of {dayWords(week.weekOf)} &middot; times in {week.timezone}
      </p>
      {week.google === "unreadable" ? (
        <div className="mt-3">
          <CentredCardNotice>
            Google could not be read for this week, so its busy times are missing below. Everything
            else is shown.
          </CentredCardNotice>
        </div>
      ) : null}

      <ol className="mt-4 grid gap-3 md:grid-cols-7">
        {week.days.map((day) => (
          <ScheduleDay key={day.date} day={day} timezone={week.timezone} />
        ))}
      </ol>
    </div>
  );
}

function ScheduleDay({ day, timezone }: { day: ScheduleDayType; timezone: string }) {
  return (
    <li className="min-w-0 rounded-lg border border-border bg-card p-3">
      <h2 className="text-sm font-semibold text-foreground">{dayWords(day.date)}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {day.closed
          ? "Closed"
          : day.hours.length === 0
            ? "No bookable hours"
            : day.hours
                .map(
                  (window) => `${clockWords(window.startMinute)}–${clockWords(window.endMinute)}`
                )
                .join(", ")}
      </p>
      {day.items.length === 0 ? null : (
        <ul className="mt-3 flex flex-col gap-2">
          {day.items.map((item, index) => (
            <li
              key={`${item.kind}-${item.startsAt}-${index}`}
              className={`rounded-md border px-2 py-1.5 text-xs ${KIND_STYLES[item.kind]}`}
            >
              <p className="font-medium text-foreground">
                {itemTime(item.startsAt, timezone, day.date)}–
                {itemTime(item.endsAt, timezone, day.date)}
              </p>
              {item.kind === "booking" ? (
                <p className="mt-0.5 text-foreground">
                  <Link
                    href={`/leads/${item.booking.leadId}`}
                    className="underline underline-offset-2"
                  >
                    {item.booking.customerName}
                  </Link>
                  <span className="text-muted-foreground">
                    {" "}
                    &middot; {item.booking.serviceName}
                    {item.booking.placeName ? ` · ${item.booking.placeName}` : ""}
                  </span>
                </p>
              ) : (
                <p className="mt-0.5 text-muted-foreground">
                  {item.kind === "time_off" ? "Time off" : "Busy in Google"}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
