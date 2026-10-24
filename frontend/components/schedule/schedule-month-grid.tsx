// Frontend component: the Calendar's Month view: the weeks that show the month, one cell a day with
// its bookings and time off; a day opens in the Day view. Google busy times show in Day and Week only.

"use client";

import type { ScheduleDayType } from "@/lib/api-client/schedule/fetch-schedule-week";
import { calendarDayWords } from "@/lib/calendar-day-words";
import { placeInZone } from "@/lib/calendar-dates";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

import { clockWords, KIND_STYLES } from "@/components/schedule/schedule-time-grid";

const SHOWN_PER_DAY = 3;

export function ScheduleMonthGrid({
  days,
  month,
  today,
  timezone,
  onOpenDay,
}: {
  days: ScheduleDayType[]; // whole weeks, Monday first
  month: string; // YYYY-MM
  today: string;
  timezone: string;
  onOpenDay: (date: string) => void;
}) {
  const { words } = useDashboardWords();
  const scheduleWords = words.scheduleWords;
  const weekdayNames = days
    .slice(0, 7)
    .map((day) =>
      new Intl.DateTimeFormat(words.intlLocale, { timeZone: "UTC", weekday: "short" }).format(
        new Date(`${day.date}T12:00:00Z`)
      )
    );

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <div className="grid min-w-[42rem] grid-cols-7">
        {weekdayNames.map((name) => (
          <div
            key={name}
            className="border-b border-border px-2 py-1.5 text-xs font-medium text-muted-foreground"
          >
            {name}
          </div>
        ))}
        {days.map((day, index) => {
          const shown = day.items.filter((item) => item.kind !== "google_busy");
          const inMonth = day.date.startsWith(month);
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onOpenDay(day.date)}
              aria-label={scheduleWords.openDay(calendarDayWords(day.date, words.intlLocale))}
              className={`flex min-h-24 flex-col gap-1 border-border p-1.5 text-left align-top hover:bg-muted/60 ${
                index % 7 === 0 ? "" : "border-l"
              } ${index < 7 ? "" : "border-t"} ${inMonth ? "" : "bg-muted/40 text-muted-foreground"}`}
            >
              <span
                className={`flex size-6 items-center justify-center rounded-full text-xs font-medium ${
                  day.date === today ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : ""
                }`}
              >
                {Number(day.date.slice(8))}
              </span>
              {day.closed ? (
                <span className="text-[11px] text-muted-foreground">{scheduleWords.closed}</span>
              ) : null}
              {shown.slice(0, SHOWN_PER_DAY).map((item, itemIndex) => (
                <span
                  key={`${item.kind}-${item.startsAt}-${itemIndex}`}
                  className={`truncate rounded border px-1 text-[11px] leading-5 ${KIND_STYLES[item.kind]}`}
                >
                  {item.kind === "booking"
                    ? `${clockWords(placeInZone(item.startsAt, timezone).minute, words)} ${item.booking.customerName}`
                    : scheduleWords.timeOff}
                </span>
              ))}
              {shown.length > SHOWN_PER_DAY ? (
                <span className="text-[11px] text-muted-foreground">
                  {scheduleWords.moreItems(shown.length - SHOWN_PER_DAY)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
