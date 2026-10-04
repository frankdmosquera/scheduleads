// Frontend: "Change the time" on the customer's booking page (feature 7b). Who first, any available
// or a named person who offers the service (decision 10), then the free times a week at a time in
// the business's zone, never before today, then one more question before the move. Every state has
// its own plain words: no times that week, a time just taken, times that cannot load, and a failure
// that keeps the choice usable. A booking that can no longer move goes back to the page.

"use client";

import { useEffect, useRef, useState } from "react";

import { formatBookingTime } from "@scheduleads-app/shared/booking-time";

import {
  fetchBookingMoveTimes,
  moveBookingPage,
  type BookingMoveTimesResultType,
  type BookingPageType,
} from "@/lib/api-client";

const DAY_MS = 86_400_000;

// A moment's calendar date in a zone, as YYYY-MM-DD (en-CA writes dates that way).
const dateIn = (moment: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(moment);

const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

// "Tuesday, October 13" for a calendar date; noon UTC names the same day everywhere.
const dayName = (date: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));

// "Oct 4", short enough for the week bar on a phone.
const shortDayName = (date: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", month: "short", day: "numeric" }).format(
    new Date(`${date}T12:00:00Z`)
  );

const timeOfDay = (moment: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, hour: "numeric", minute: "2-digit" }).format(moment);

// The start times grouped by their day in the business's zone, in order.
function byDay(startTimes: string[], timeZone: string): { date: string; times: string[] }[] {
  const days = new Map<string, string[]>();
  for (const startsAt of startTimes) {
    const date = dateIn(new Date(startsAt), timeZone);
    days.set(date, [...(days.get(date) ?? []), startsAt]);
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
  const [personId, setPersonId] = useState<string | null>(null); // null = any available
  const [weekOffset, setWeekOffset] = useState(0); // 0 = the week starting today
  const [reloads, setReloads] = useState(0);
  const [result, setResult] = useState<BookingMoveTimesResultType | null>(null);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [chosen, setChosen] = useState<string | null>(null); // the start asked about once more
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  // Today in the business's zone, read once: the week never starts before it.
  const [today] = useState(() => dateIn(new Date(), timezone));
  const from = addDays(today, weekOffset * 7);
  const to = addDays(from, 6);

  useEffect(() => {
    heading.current?.focus(); // the button that opened the panel is gone
  }, []);

  // The week and person asked about changed: "Finding free times…" until their answer lands.
  const askAgain = () => {
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
      if (next.state === "ok") setPeople(next.times.people);
      setResult(next);
    });
    return () => {
      live = false;
    };
  }, [token, from, to, personId, reloads, onCannotMove]);

  async function move() {
    if (!chosen) return;
    setSending(true);
    setProblem(null);
    const answer = await moveBookingPage(token, { startsAt: chosen, personId });
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
    // The question stays: pressing again is safe.
    setProblem(
      answer.state === "not-found"
        ? "This link no longer opens a booking. Please call the business."
        : "The move didn't go through. Please try again, or call the business."
    );
  }

  const outlineButton =
    "rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60";

  if (chosen) {
    return (
      <div role="group" aria-labelledby="confirm-move">
        <p id="confirm-move" role="status" className="text-sm font-medium text-slate-900">
          {`Move to ${formatBookingTime(new Date(chosen), timezone)}?`}
        </p>
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={move}
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

  // Her own time is not a move unless another person is picked: the page knows its person by name.
  const pickedName = people.find((person) => person.id === personId)?.name;
  const keepsPerson = personId === null || pickedName === booking.person;
  const startTimes =
    result?.state === "ok"
      ? result.times.startTimes.filter(
          (startsAt) => !(keepsPerson && Date.parse(startsAt) === Date.parse(booking.startsAt))
        )
      : [];
  const days = byDay(startTimes, timezone);
  const count = startTimes.length;

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

      <label className="mt-4 block text-xs uppercase tracking-wider text-slate-500" htmlFor="who">
        Who
      </label>
      <select
        id="who"
        value={personId ?? ""}
        onChange={(event) => {
          askAgain();
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

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            askAgain();
            setWeekOffset((n) => n - 1);
          }}
          disabled={weekOffset === 0}
          className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
        >
          ‹ Earlier
        </button>
        <p className="whitespace-nowrap text-sm font-medium text-slate-900">
          {`${shortDayName(from)} to ${shortDayName(to)}`}
        </p>
        <button
          type="button"
          onClick={() => {
            askAgain();
            setWeekOffset((n) => n + 1);
          }}
          className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Later ›
        </button>
      </div>

      {problem ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {problem}
        </p>
      ) : null}

      <div className="mt-3">
        {!result ? (
          <p role="status" className="text-sm text-slate-500">
            Finding free times…
          </p>
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
                askAgain();
                setReloads((n) => n + 1);
              }}
              className={`mt-3 w-full ${outlineButton}`}
            >
              Try again
            </button>
          </div>
        ) : count === 0 ? (
          <div>
            <p role="status" className="text-sm text-slate-700">
              No free times this week.
            </p>
            <button
              type="button"
              onClick={() => {
                askAgain();
                setWeekOffset((n) => n + 1);
              }}
              className={`mt-3 w-full ${outlineButton}`}
            >
              Show the next week
            </button>
          </div>
        ) : (
          <>
            <p role="status" className="sr-only">
              {`${count} free ${count === 1 ? "time" : "times"} this week.`}
            </p>
            <div className="space-y-4">
              {days.map((day) => (
                <div key={day.date} role="group" aria-labelledby={`day-${day.date}`}>
                  <h3 id={`day-${day.date}`} className="text-sm font-medium text-slate-900">
                    {dayName(day.date)}
                  </h3>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {day.times.map((startsAt) => (
                      <button
                        key={startsAt}
                        type="button"
                        onClick={() => {
                          setProblem(null);
                          setChosen(startsAt);
                        }}
                        className="rounded-lg border border-slate-300 px-2 py-2.5 text-sm text-slate-900 hover:bg-slate-50"
                      >
                        {timeOfDay(new Date(startsAt), timezone)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <button type="button" onClick={onClose} className={`mt-6 w-full ${outlineButton}`}>
        Keep the current time
      </button>
    </section>
  );
}
