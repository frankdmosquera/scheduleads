// Frontend: "Change the time" on the customer's booking page (feature 7b). Who first, opening on her
// own person (decision 14), any available or anyone else who offers the service (decision 10), then
// the free times a week at a time in the business's zone, never before today, then one more question
// naming the time and the person before the move. A service the business assigns has no Who: any
// available, and the question names the time only (feature 9, decision 3). Every state has its own plain words: no times that
// week, a time just taken, times that cannot load, and a failure that keeps the choice usable. A
// booking that can no longer move goes back to the page.

"use client";

import { useEffect, useRef, useState } from "react";

import { addDays } from "@scheduleads-app/shared/add-days";
import { localDate } from "@scheduleads-app/shared/local-date";
import { telHref } from "@scheduleads-app/shared/tel-href";

import {
  fetchBookingMoveTimes,
  type BookingMoveStartTimeType,
  type BookingMoveTimesResultType,
} from "@/lib/api-client/customer-booking/fetch-booking-move-times";
import { type BookingPageType } from "@/lib/api-client/customer-booking/fetch-booking-page";
import { moveBookingPage } from "@/lib/api-client/customer-booking/move-booking-page";

// "Tuesday, October 13" for a calendar date; noon UTC names the same day everywhere.
const formatDayName = (date: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));

// "Oct 4 to 10", or "Sep 28 to Oct 4" across two months: short enough for a phone at 320px.
function formatWeekName(from: string, to: string): string {
  const named = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", ...options }).format(
      new Date(`${date}T12:00:00Z`)
    );
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  return `${named(from, { month: "short", day: "numeric" })} to ${named(to, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" })}`;
}

// The start times grouped by the business's date the API sent with each, in order. The API names
// every date and time: the browser's own time-zone rules may be older than its.
function groupTimesByDay(
  startTimes: BookingMoveStartTimeType[]
): { date: string; times: BookingMoveStartTimeType[] }[] {
  const days = new Map<string, BookingMoveStartTimeType[]>();
  for (const startTime of startTimes) {
    days.set(startTime.date, [...(days.get(startTime.date) ?? []), startTime]);
  }
  return [...days].map(([date, times]) => ({ date, times }));
}

export type CannotMoveType = "already-started" | "already-cancelled";

export function ChangeTimePanel({
  token,
  booking,
  brand,
  onBrand,
  onMoved,
  onCannotMove,
  onClose,
}: {
  token: string;
  booking: BookingPageType;
  brand: string;
  onBrand: string;
  onMoved: (booking: BookingPageType) => void;
  onCannotMove: (reason: CannotMoveType) => void;
  onClose: () => void;
}) {
  const { timezone } = booking;
  // The business sends whoever is free (feature 9, decision 3): no pick, any available.
  const assigns = booking.personChoice === "business_assigns";
  // null = any available. Her own person first, so keeping the default never changes who she sees.
  const [personId, setPersonId] = useState<string | null>(assigns ? null : booking.personId);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = the week starting today
  const [reloads, setReloads] = useState(0);
  const [result, setResult] = useState<BookingMoveTimesResultType | null>(null);
  // Her own person until the first answer lists everyone who offers the service.
  const [people, setPeople] = useState([{ id: booking.personId, name: booking.person }]);
  const [lastDate, setLastDate] = useState<string | null>(null); // the last date it takes bookings
  const [chosen, setChosen] = useState<BookingMoveStartTimeType | null>(null); // asked once more
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const yesRef = useRef<HTMLButtonElement>(null);
  const laterRef = useRef<HTMLButtonElement>(null);
  const earlierRef = useRef<HTMLButtonElement>(null);

  // Today in the business's zone, read once: the week never starts before it.
  const [today] = useState(() => localDate(new Date(), timezone));
  const from = addDays(today, weekOffset * 7);
  const to = addDays(from, 6);

  useEffect(() => {
    heading.current?.focus(); // the button that opened the panel is gone
  }, []);

  // The week and person asked about changed: "Finding free times…" until their answer lands.
  const clearTimesForNewQuestion = () => {
    setResult(null);
    setProblem(null);
  };

  useEffect(() => {
    if (chosen) keepRef.current?.focus(); // the safe answer comes first
  }, [chosen]);

  useEffect(() => {
    let live = true; // a late answer for another week or person never replaces this one
    fetchBookingMoveTimes(token, { from, to, personId }).then((next) => {
      if (!live) return;
      if (next.state === "already-started" || next.state === "already-cancelled") {
        onCannotMove(next.state);
        return;
      }
      // Her person no longer offers the service: the times route refuses them, so any available.
      if (next.state === "not-found" && personId !== null && personId === booking.personId) {
        setPersonId(null);
        return;
      }
      if (next.state === "ok") {
        setPeople(next.times.people);
        setLastDate(next.times.lastDate);
      }
      setResult(next);
    });
    return () => {
      live = false;
    };
  }, [token, from, to, personId, booking.personId, reloads, onCannotMove]);

  async function moveToChosenTime() {
    if (!chosen) return;
    setSending(true);
    setProblem(null);
    const answer = await moveBookingPage(token, { startsAt: chosen.startsAt, personId });
    setSending(false);
    if (answer.state === "ok") {
      onMoved(answer.booking);
      return;
    }
    if (answer.state === "already-started" || answer.state === "already-cancelled") {
      onCannotMove(answer.state);
      return;
    }
    if (answer.state === "time-taken") {
      setChosen(null);
      setResult(null);
      setProblem("That time was just taken. Pick another.");
      setReloads((n) => n + 1); // the times again, without the one just taken
      requestAnimationFrame(() => heading.current?.focus());
      return;
    }
    // The question stays: pressing again is safe. Its button was locked while sending, so focus
    // goes back to it.
    requestAnimationFrame(() => yesRef.current?.focus());
    setProblem(
      answer.state === "not-found"
        ? "This link no longer opens a booking. Please call the business."
        : "The move didn't go through. Please try again, or call the business."
    );
  }

  const outlineButton =
    "rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60";

  if (chosen) {
    const withWhom = assigns
      ? ""
      : ` with ${people.find((person) => person.id === personId)?.name ?? "any available person"}`;
    return (
      <div role="group" aria-labelledby="confirm-move">
        <p id="confirm-move" role="status" className="text-sm font-medium text-slate-900">
          {`Move to ${chosen.when}${withWhom}?`}
        </p>
        <div className="mt-3 flex gap-3">
          <button
            ref={yesRef}
            type="button"
            onClick={moveToChosenTime}
            disabled={sending}
            style={{ backgroundColor: brand, color: onBrand }}
            className="flex-1 rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {sending ? "Moving…" : "Yes, move it"}
          </button>
          <button
            ref={keepRef}
            type="button"
            onClick={() => {
              setChosen(null);
              setProblem(null);
              requestAnimationFrame(() => heading.current?.focus());
            }}
            disabled={sending}
            className={`flex-1 ${outlineButton}`}
          >
            Keep the current time
          </button>
        </div>
        {problem ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {problem}
          </p>
        ) : null}
      </div>
    );
  }

  // Her own time is not a move unless another person is picked (decision 4 answers it unchanged).
  const keepsPerson = personId === null || personId === booking.personId;
  const startTimes =
    result?.state === "ok"
      ? result.times.localStartTimes.filter(
          ({ startsAt }) => !(keepsPerson && Date.parse(startsAt) === Date.parse(booking.startsAt))
        )
      : [];
  const days = groupTimesByDay(startTimes);
  const count = startTimes.length;
  const week = formatWeekName(from, to);
  // The week holding the business's last bookable date: nothing later can be booked.
  const isLastWeek = lastDate !== null && to >= lastDate;
  const booksUpTo = lastDate
    ? `${booking.business.name} takes bookings up to ${formatDayName(lastDate)}.`
    : "";
  // One live region, always there, so every new week or person is read out.
  const announcement = !result
    ? "Finding free times…"
    : result.state !== "ok"
      ? ""
      : count === 0
        ? `${week}: no free times.${isLastWeek ? ` ${booksUpTo}` : ""}`
        : `${week}: ${count} free ${count === 1 ? "time" : "times"}.${isLastWeek ? ` ${booksUpTo}` : ""}`;

  return (
    <section aria-labelledby="change-time-heading">
      <h2
        id="change-time-heading"
        ref={heading}
        tabIndex={-1}
        className="text-base font-semibold text-slate-900 outline-none"
      >
        Pick a new time
      </h2>

      {assigns ? null : (
        <>
          <label
            className="mt-4 block text-xs uppercase tracking-wider text-slate-500"
            htmlFor="who"
          >
            Who
          </label>
          <select
            id="who"
            value={personId ?? ""}
            onChange={(event) => {
              clearTimesForNewQuestion();
              setPersonId(event.target.value || null);
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
          >
            <option value="">Any available</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          ref={earlierRef}
          type="button"
          onClick={() => {
            clearTimesForNewQuestion();
            setWeekOffset((n) => n - 1);
            // The first week turns this button off, so focus moves on to Later.
            if (weekOffset === 1) laterRef.current?.focus();
          }}
          disabled={weekOffset === 0}
          className="whitespace-nowrap rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
        >
          ‹ Earlier
        </button>
        <p className="min-w-0 text-center text-sm font-medium text-slate-900">{week}</p>
        <button
          ref={laterRef}
          type="button"
          onClick={() => {
            clearTimesForNewQuestion();
            setWeekOffset((n) => n + 1);
            // The last week turns this button off, so focus moves back to Earlier.
            if (lastDate !== null && addDays(to, 7) >= lastDate) earlierRef.current?.focus();
          }}
          disabled={isLastWeek}
          className="whitespace-nowrap rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
        >
          Later ›
        </button>
      </div>

      {problem ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {problem}
        </p>
      ) : null}

      <p role="status" className="sr-only">
        {announcement}
      </p>

      <div className="mt-3">
        {!result ? (
          <p className="text-sm text-slate-500">Finding free times…</p>
        ) : result.state === "not-found" ? (
          <p role="alert" className="text-sm text-red-700">
            This link no longer opens a booking. Please call the business.
          </p>
        ) : result.state === "unreachable" ? (
          <div>
            <p role="alert" className="text-sm text-slate-700">
              The free times can&apos;t load right now.
            </p>
            <button
              type="button"
              onClick={() => {
                clearTimesForNewQuestion();
                setReloads((n) => n + 1);
              }}
              className={`mt-3 w-full ${outlineButton}`}
            >
              Try again
            </button>
          </div>
        ) : count === 0 ? (
          <div>
            <p className="text-sm text-slate-700">No free times this week.</p>
            {isLastWeek ? null : (
              <button
                type="button"
                onClick={() => {
                  clearTimesForNewQuestion();
                  setWeekOffset((n) => n + 1);
                }}
                className={`mt-3 w-full ${outlineButton}`}
              >
                Show the next week
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {days.map((day) => (
                <div key={day.date} role="group" aria-labelledby={`day-${day.date}`}>
                  <h3 id={`day-${day.date}`} className="text-sm font-medium text-slate-900">
                    {formatDayName(day.date)}
                  </h3>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {day.times.map((startTime) => (
                      <button
                        key={startTime.startsAt}
                        type="button"
                        onClick={() => {
                          setProblem(null);
                          setChosen(startTime);
                        }}
                        className="rounded-lg border border-slate-300 px-2 py-2.5 text-sm text-slate-900 hover:bg-slate-50"
                      >
                        {startTime.time}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {isLastWeek && result?.state === "ok" ? (
        <p className="mt-4 text-sm leading-6 text-slate-600">
          {booksUpTo}
          {booking.business.phone ? (
            <>
              {" To book later, call "}
              <a
                href={telHref(booking.business.phone)}
                className="font-medium text-slate-900 underline"
              >
                {booking.business.phone}
              </a>
              .
            </>
          ) : null}
        </p>
      ) : null}

      <button type="button" onClick={onClose} className={`mt-6 w-full ${outlineButton}`}>
        Keep the current time
      </button>
    </section>
  );
}
