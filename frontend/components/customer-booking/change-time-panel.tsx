// Frontend: "Change the time" on the customer's booking page (feature 7b). Who first, opening on her
// own person (decision 14), any available or anyone else who offers the service (decision 10), then
// the free times a week at a time in the business's zone, never before today, then one more question
// naming the time and the person before the move. A service the business assigns has no Who: any
// available, and the question names the time only (feature 9, decision 3). Every state has its own plain words: no times that
// week, a time just taken, times that cannot load, and a failure that keeps the choice usable. A
// booking that can no longer move goes back to the page. Its words are the booking's language.

"use client";

import { useEffect, useRef, useState } from "react";

import { addDays } from "@scheduleads-app/shared/add-days";
import { capitalized } from "@scheduleads-app/shared/booking-time";
import { localDate } from "@scheduleads-app/shared/local-date";
import { telHref } from "@scheduleads-app/shared/tel-href";

import {
  fetchBookingMoveTimes,
  type BookingMoveStartTimeType,
  type BookingMoveTimesResultType,
} from "@/lib/api-client/customer-booking/fetch-booking-move-times";
import { type BookingPageType } from "@/lib/api-client/customer-booking/fetch-booking-page";
import { moveBookingPage } from "@/lib/api-client/customer-booking/move-booking-page";

import type { CustomerBookingWordsType } from "./customer-booking-words";

// "Tuesday, October 13" for a calendar date; noon UTC names the same day everywhere.
const formatDayName = (date: string, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));

// "Oct 4 to 10", or "Sep 28 to Oct 4" across two months: short enough for a phone at 320px.
function formatWeekName(from: string, to: string, words: CustomerBookingWordsType): string {
  const named = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(words.intlLocale, { timeZone: "UTC", ...options }).format(
      new Date(`${date}T12:00:00Z`)
    );
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  // Spanish names the month after its days: "4 al 10 oct", "28 sept al 4 oct".
  if (words.intlLocale.startsWith("es"))
    return `${named(from, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" })} ${words.weekTo} ${named(to, { month: "short", day: "numeric" })}`;
  return `${named(from, { month: "short", day: "numeric" })} ${words.weekTo} ${named(to, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" })}`;
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
  words,
  brand,
  onBrand,
  onMoved,
  onCannotMove,
  onClose,
}: {
  token: string;
  booking: BookingPageType;
  words: CustomerBookingWordsType;
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
    fetchBookingMoveTimes(token, { from, to, personId, language: booking.language }).then(
      (next) => {
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
      }
    );
    return () => {
      live = false;
    };
  }, [token, from, to, personId, booking.personId, booking.language, reloads, onCannotMove]);

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
      setProblem(words.timeJustTaken);
      setReloads((n) => n + 1); // the times again, without the one just taken
      requestAnimationFrame(() => heading.current?.focus());
      return;
    }
    // The question stays: pressing again is safe. Its button was locked while sending, so focus
    // goes back to it.
    requestAnimationFrame(() => yesRef.current?.focus());
    setProblem(answer.state === "not-found" ? words.linkGone : words.moveFailed);
  }

  const outlineButton =
    "rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60";

  if (chosen) {
    const withWhom = assigns
      ? null
      : (people.find((person) => person.id === personId)?.name ?? words.anyAvailablePerson);
    return (
      <div role="group" aria-labelledby="confirm-move">
        <p id="confirm-move" role="status" className="text-sm font-medium text-slate-900">
          {words.moveQuestion(chosen.when, withWhom)}
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
            {sending ? words.moving : words.yesMoveIt}
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
            {words.keepTheCurrentTime}
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
  const week = formatWeekName(from, to, words);
  // The week holding the business's last bookable date: nothing later can be booked.
  const isLastWeek = lastDate !== null && to >= lastDate;
  const booksUpTo = lastDate
    ? words.booksUpTo(booking.business.name, formatDayName(lastDate, words.intlLocale))
    : "";
  // One live region, always there, so every new week or person is read out.
  const announcement = !result
    ? words.findingTimes
    : result.state !== "ok"
      ? ""
      : count === 0
        ? `${words.weekHasNoTimes(week)}${isLastWeek ? ` ${booksUpTo}` : ""}`
        : `${words.weekHasTimes(week, count)}${isLastWeek ? ` ${booksUpTo}` : ""}`;

  return (
    <section aria-labelledby="change-time-heading">
      <h2
        id="change-time-heading"
        ref={heading}
        tabIndex={-1}
        className="text-base font-semibold text-slate-900 outline-none"
      >
        {words.pickANewTime}
      </h2>

      {assigns ? null : (
        <>
          <label
            className="mt-4 block text-xs uppercase tracking-wider text-slate-500"
            htmlFor="who"
          >
            {words.who}
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
            <option value="">{words.anyAvailable}</option>
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
          {words.earlier}
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
          {words.later}
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
          <p className="text-sm text-slate-500">{words.findingTimes}</p>
        ) : result.state === "not-found" ? (
          <p role="alert" className="text-sm text-red-700">
            {words.linkGone}
          </p>
        ) : result.state === "unreachable" ? (
          <div>
            <p role="alert" className="text-sm text-slate-700">
              {words.timesCannotLoad}
            </p>
            <button
              type="button"
              onClick={() => {
                clearTimesForNewQuestion();
                setReloads((n) => n + 1);
              }}
              className={`mt-3 w-full ${outlineButton}`}
            >
              {words.tryAgain}
            </button>
          </div>
        ) : count === 0 ? (
          <div>
            <p className="text-sm text-slate-700">{words.noTimesThisWeek}</p>
            {isLastWeek ? null : (
              <button
                type="button"
                onClick={() => {
                  clearTimesForNewQuestion();
                  setWeekOffset((n) => n + 1);
                }}
                className={`mt-3 w-full ${outlineButton}`}
              >
                {words.showNextWeek}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {days.map((day) => (
                <div key={day.date} role="group" aria-labelledby={`day-${day.date}`}>
                  <h3 id={`day-${day.date}`} className="text-sm font-medium text-slate-900">
                    {capitalized(formatDayName(day.date, words.intlLocale))}
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
              {words.toBookLaterCall}
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
        {words.keepTheCurrentTime}
      </button>
    </section>
  );
}
