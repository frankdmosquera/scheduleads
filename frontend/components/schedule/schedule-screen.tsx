// Frontend component: the Calendar page (feature 12b): one person's or place's calendar in the
// business's time zone, as a Day, Week or Month: the online booking hours, closed days, bookings,
// time off and Google busy times. Booking by hand and time off open from buttons.

"use client";

import { useEffect, useState } from "react";

import { addDays } from "@scheduleads-app/shared/add-days";
import { capitalized } from "@scheduleads-app/shared/booking-time";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { RefusalNotice } from "@/components/centred-card/refusal-notice";
import { BookByHandForm } from "@/components/schedule/book-by-hand-form";
import { ScheduleMonthGrid } from "@/components/schedule/schedule-month-grid";
import { KIND_STYLES, ScheduleTimeGrid } from "@/components/schedule/schedule-time-grid";
import { TimeOffForm } from "@/components/schedule/time-off-form";
import { Button } from "@/components/ui/button";
import {
  fetchScheduleWeek,
  type ScheduleWeekResultType,
  type ScheduleWeekType,
} from "@/lib/api-client/schedule/fetch-schedule-week";
import { calendarDayWords } from "@/lib/calendar-day-words";
import {
  addMonths,
  firstOfMonth,
  mondayOf,
  todayInZone,
  weeksOfMonth,
  type CalendarViewType,
} from "@/lib/calendar-dates";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

type AskedType = { resourceId?: string; date?: string }; // no date: today, as the API knows it

// A refusal from any of the weeks asked, else every week: one for a Day or a Week, four to six for a Month.
type CalendarResultType =
  Exclude<ScheduleWeekResultType, { state: "ok" }> | { state: "ok"; weeks: ScheduleWeekType[] };

async function fetchCalendar(
  asked: AskedType,
  view: CalendarViewType
): Promise<CalendarResultType> {
  const mondays = !asked.date
    ? [undefined]
    : view === "month"
      ? weeksOfMonth(asked.date)
      : [mondayOf(asked.date)];
  const answers = await Promise.all(
    mondays.map((weekOf) => fetchScheduleWeek({ resourceId: asked.resourceId, weekOf }))
  );
  for (const answer of answers) if (answer.state !== "ok") return answer;
  return {
    state: "ok",
    weeks: answers.flatMap((answer) => (answer.state === "ok" ? [answer.week] : [])),
  };
}

export function ScheduleScreen() {
  const { words } = useDashboardWords();
  const [view, setView] = useState<CalendarViewType>("week");
  const [asked, setAsked] = useState<AskedType>({});
  // The answer with what it was asked for, so the calendar on screen always matches its own days.
  const [shown, setShown] = useState<{
    asked: AskedType;
    view: CalendarViewType;
    result: CalendarResultType;
  } | null>(null);
  const [attempt, setAttempt] = useState(0); // Try again, or a change saved: ask once more

  useEffect(() => {
    // `live` stops a late answer from updating a page the user already left.
    let live = true;
    fetchCalendar(asked, view).then((result) => {
      if (live) setShown({ asked, view, result });
    });
    return () => {
      live = false;
    };
  }, [asked, view, attempt]);

  // The calendar on screen stays, dimmed, until the next days come, so the page never jumps.
  const ask = (next: AskedType, nextView: CalendarViewType = view) => {
    setView(nextView);
    setAsked(next);
  };
  const busy = shown !== null && (shown.asked !== asked || shown.view !== view);
  const result = shown?.result ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{words.calendar}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{words.scheduleWords.lede}</p>

      <div className="mt-6">
        {!result ? (
          <p className="text-sm text-muted-foreground">{words.scheduleWords.loading}</p>
        ) : result.state === "signed-out" || result.state === "refused" ? (
          <RefusalNotice refusal={result} />
        ) : result.state === "unreachable" ? (
          <div className="flex flex-col items-start gap-3">
            <CentredCardNotice>{result.message}</CentredCardNotice>
            <Button
              variant="outline"
              onClick={() => {
                setShown(null);
                setAttempt((count) => count + 1);
              }}
            >
              {words.tryAgain}
            </Button>
          </div>
        ) : (
          <div aria-busy={busy} className={busy ? "opacity-60 transition-opacity" : undefined}>
            <ScheduleCalendar
              weeks={result.weeks}
              view={shown!.view}
              date={shown!.asked.date}
              onAsk={ask}
              onRefresh={() => setAttempt((count) => count + 1)} // the same days again, in place
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ScheduleCalendar({
  weeks,
  view,
  date,
  onAsk,
  onRefresh,
}: {
  weeks: ScheduleWeekType[];
  view: CalendarViewType;
  date: string | undefined;
  onAsk: (next: AskedType, view?: CalendarViewType) => void;
  onRefresh: () => void;
}) {
  const { words } = useDashboardWords();
  const scheduleWords = words.scheduleWords;
  const [form, setForm] = useState<"book" | "time-off" | null>(null);
  const first = weeks[0];
  const resourceId = first.resource.id;
  const timezone = first.timezone;
  const today = todayInZone(timezone);
  const shown = date ?? (first.days.some((day) => day.date === today) ? today : first.weekOf);
  const allDays = weeks.flatMap((week) => week.days);
  const days =
    view === "day"
      ? allDays.filter((day) => day.date === shown)
      : view === "week"
        ? first.days
        : allDays;
  const month = shown.slice(0, 7);
  const datesToBook =
    view === "month" ? allDays.filter((day) => day.date.startsWith(month)) : first.days;

  const step = (direction: 1 | -1) =>
    onAsk({
      resourceId,
      date:
        view === "day"
          ? addDays(shown, direction)
          : view === "week"
            ? addDays(shown, 7 * direction)
            : addMonths(shown, direction),
    });

  const heading =
    view === "day"
      ? scheduleWords.dayOf(calendarDayWords(shown, words.intlLocale), timezone)
      : view === "week"
        ? scheduleWords.weekOf(calendarDayWords(first.weekOf, words.intlLocale), timezone)
        : scheduleWords.monthOf(
            capitalized(
              new Intl.DateTimeFormat(words.intlLocale, {
                timeZone: "UTC",
                month: "long",
                year: "numeric",
              }).format(new Date(`${firstOfMonth(shown)}T12:00:00Z`))
            ),
            timezone
          );

  const toggle = (which: "book" | "time-off") => setForm((open) => (open === which ? null : which));
  const views: { view: CalendarViewType; word: string }[] = [
    { view: "day", word: scheduleWords.dayView },
    { view: "week", word: scheduleWords.weekView },
    { view: "month", word: scheduleWords.monthView },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {first.resources.length > 1 ? (
          <label className="flex w-full items-center gap-2 sm:w-auto">
            <span className="text-sm whitespace-nowrap text-muted-foreground">
              {scheduleWords.calendarOf}
            </span>
            <select
              value={resourceId}
              onChange={(event) => onAsk({ resourceId: event.target.value, date: shown })}
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-base font-medium sm:flex-none"
            >
              {first.resources.map((one) => (
                <option key={one.id} value={one.id}>
                  {one.name}
                  {one.kind === "place" ? scheduleWords.placeSuffix : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-base font-medium text-foreground">{first.resource.name}</p>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {first.canEdit && first.resource.kind === "person" ? (
            <Button
              variant={form === "book" ? "default" : "outline"}
              size="sm"
              aria-expanded={form === "book"}
              onClick={() => toggle("book")}
            >
              {scheduleWords.bookByHand}
            </Button>
          ) : null}
          {first.canEdit ? (
            <Button
              variant={form === "time-off" ? "default" : "outline"}
              size="sm"
              aria-expanded={form === "time-off"}
              onClick={() => toggle("time-off")}
            >
              {scheduleWords.timeOff}
            </Button>
          ) : null}
        </div>
      </div>

      {form ? (
        <div className="mt-4">
          <div className="mb-1 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setForm(null)}>
              {scheduleWords.closeForm}
            </Button>
          </div>
          {form === "book" ? (
            <BookByHandForm
              key={`${resourceId}-${datesToBook[0]?.date}`}
              personId={resourceId}
              dates={datesToBook.map((day) => day.date)}
              onBooked={onRefresh}
            />
          ) : (
            <TimeOffForm
              key={resourceId}
              resourceId={resourceId}
              firstDate={shown}
              timezone={timezone}
              onSaved={onRefresh}
            />
          )}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label={scheduleWords.viewLabel}
          className="flex rounded-md border border-border"
        >
          {views.map((one) => (
            <button
              key={one.view}
              type="button"
              aria-pressed={view === one.view}
              onClick={() => onAsk({ resourceId, date: shown }, one.view)}
              className="px-3 py-1.5 text-sm text-muted-foreground first:rounded-l-md last:rounded-r-md hover:text-foreground aria-pressed:bg-muted aria-pressed:font-medium aria-pressed:text-foreground"
            >
              {one.word}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => step(-1)}>
            {scheduleWords.previous}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onAsk({ resourceId, date: today })}>
            {scheduleWords.today}
          </Button>
          <Button variant="outline" size="sm" onClick={() => step(1)}>
            {scheduleWords.next}
          </Button>
        </div>
        <p className="text-sm font-medium text-foreground">{heading}</p>
      </div>

      {weeks.some((week) => week.google === "unreadable") ? (
        <div className="mt-3">
          <CentredCardNotice>{scheduleWords.googleUnreadable}</CentredCardNotice>
        </div>
      ) : null}

      <div className="mt-4">
        {view === "month" ? (
          <ScheduleMonthGrid
            days={allDays}
            month={month}
            today={today}
            timezone={timezone}
            onOpenDay={(day) => onAsk({ resourceId, date: day }, "day")}
          />
        ) : (
          <ScheduleTimeGrid
            days={days}
            today={today}
            timezone={timezone}
            canEdit={first.canEdit}
            onChanged={onRefresh}
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-3 rounded-sm bg-[var(--info-soft)] ring-1 ring-border"
          />
          {scheduleWords.hoursExplained}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className={`size-3 rounded-sm border ${KIND_STYLES.booking}`} />
          {scheduleWords.legendBooking}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className={`size-3 rounded-sm border ${KIND_STYLES.time_off}`} />
          {scheduleWords.timeOff}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className={`size-3 rounded-sm border ${KIND_STYLES.google_busy}`} />
          {scheduleWords.busyInGoogle}
        </span>
      </div>
    </div>
  );
}
