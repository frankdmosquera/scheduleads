// Booking component: a calendar on the site's own page (feature 13c). The month comes built into the
// page from fetchPageCalendar, its open days marked; later months and a tapped day's times are read
// live. Picking a time and Next, or the site's Book button, opens the booking window on its form
// with that time chosen: the window still takes the booking. Sits inside the site's BookingProvider.

"use client";

import { localDate } from "@scheduleads-app/shared/local-date";
import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { BookingStartTimeType } from "../api-client/booking-api-types.js";
import { fetchFreeTimes } from "../api-client/fetch-free-times.js";
import { BookingContext, type PickedTimeType } from "../booking-provider/booking-context.js";
import { useBooking } from "../booking-provider/use-booking.js";
import { bookableMonths } from "../booking-window/month-calendar/bookable-months.js";
import { datesToAsk } from "../booking-window/month-calendar/dates-to-ask.js";
import { formatDayName } from "../booking-window/month-calendar/format-day-name.js";
import { formatMonthName } from "../booking-window/month-calendar/format-month-name.js";
import { formatZoneName } from "../booking-window/month-calendar/format-zone-name.js";
import { shiftMonth } from "../booking-window/month-calendar/shift-month.js";
import { DayTimesView } from "../booking-window/screens/month-layout/day-times-view.js";
import { MonthCalendarView } from "../booking-window/screens/month-layout/month-calendar-view.js";
import { useMonthTimes } from "../booking-window/screens/month-layout/use-month-times.js";
import { priceText } from "../booking-window/screens/price-text.js";
import { themeStyle } from "../booking-window/theme-style.js";
import { BookingWordsContext, wordsOf } from "../words/booking-words-context.js";
import type { PageCalendarDataType } from "./fetch-page-calendar.js";
import { monthIsBuiltIn, openDaysShown } from "./open-days-shown.js";

export type PageCalendarPropsType = {
  calendar: PageCalendarDataType;
  title?: ReactNode; // the card's heading, in the site's words
  bookLabel?: string; // the site's Book button under the calendar; left out, none
  // A second button beside it, such as "Ask us" opening the site's chat (13c.2); left out, none.
  ask?: { label: string; onAsk(): void };
  // The "Times in Mountain Time" line under the month; a site short of room leaves it out (Primo,
  // Frank, Oct 31). The window's form still names the zone.
  zoneLine?: boolean;
  className?: string;
};

type DayTimesType =
  { state: "loading" } | { state: "ok"; times: BookingStartTimeType[] } | { state: "problem" };

export function PageCalendar({
  calendar,
  title,
  bookLabel,
  ask,
  zoneLine = true,
  className,
}: PageCalendarPropsType) {
  // From the service, not useId: the same on the server's page and in the browser, however each was drawn.
  const titleId = `sa-pagecal-${calendar.service.id}`;
  const dayRef = useRef<HTMLDivElement>(null);
  const booking = useContext(BookingContext);
  if (!booking) throw new Error("<PageCalendar> must be used inside <BookingProvider>.");
  const { apiClient, slug, language } = booking;
  const { open } = useBooking();
  const words = wordsOf[language];
  const { service, timeZone } = calendar;

  // The page was built on calendar.today; the browser moves it on once it has drawn the same month,
  // so the server's page and the first draw never disagree.
  const [today, setToday] = useState(calendar.today);
  useEffect(() => setToday(localDate(new Date(), timeZone)), [timeZone]);
  const bounds = useMemo(
    () => bookableMonths(today, calendar.horizonDays),
    [today, calendar.horizonDays]
  );

  // It opens on the first month with an open day: a month whose last day just filled is skipped.
  const [month, setMonth] = useState(
    () => calendar.openDays.find((day) => day >= calendar.today)?.slice(0, 7) ?? bounds.firstMonth
  );
  const shownMonth = month < bounds.firstMonth ? bounds.firstMonth : month;
  const builtIn = monthIsBuiltIn(shownMonth, today, calendar);
  const { times: liveMonth } = useMonthTimes({
    apiClient,
    slug,
    bookingLinkId: service.id,
    dates: builtIn ? null : datesToAsk(shownMonth, bounds),
    personId: null,
    language,
  });
  const freeDays = openDaysShown(shownMonth, today, calendar, liveMonth);
  const monthRead = builtIn || liveMonth.state === "ok";

  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [dayTimes, setDayTimes] = useState<DayTimesType | null>(null);
  const [picked, setPicked] = useState<PickedTimeType | null>(null);
  const latestAsk = useRef(0); // a tap's answer that arrives after a later tap is dropped

  const pickDate = async (date: string, moveFocus = false) => {
    const tap = ++latestAsk.current;
    setMonth(date.slice(0, 7));
    setPickedDate(date);
    setPicked(null);
    setDayTimes({ state: "loading" });
    const answer = await fetchFreeTimes(apiClient, slug, service.id, {
      from: date,
      to: date,
      personId: null,
      language,
    });
    if (tap !== latestAsk.current) return;
    if (moveFocus) requestAnimationFrame(() => dayRef.current?.focus());
    setDayTimes(
      answer.state === "ok"
        ? { state: "ok", times: answer.freeTimes.localStartTimes }
        : { state: "problem" }
    );
  };

  const changeMonth = (by: -1 | 1) => {
    setMonth(shiftMonth(shownMonth, by));
    setPickedDate(null);
    setDayTimes(null);
    setPicked(null);
  };

  // The next open day after one that filled since the page was built.
  const nextOpenDay = (date: string) =>
    [...calendar.openDays, ...freeDays].filter((day) => day > date).sort()[0] ?? null;

  // One status line, always there, so a screen reader hears each change (F-604).
  const status = pickedDate
    ? dayTimes?.state === "loading"
      ? words.findingTimes
      : dayTimes?.state === "problem"
        ? words.timesUnreadable
        : dayTimes?.state === "ok" && dayTimes.times.length === 0
          ? words.noTimesLeftOn(formatDayName(pickedDate, language))
          : ""
    : !builtIn && liveMonth.state === "loading"
      ? words.findingTimes
      : monthRead && freeDays.size === 0
        ? words.noTimesLeftIn(formatMonthName(shownMonth, language))
        : "";
  const price = priceText(service.price, words);

  return (
    <BookingWordsContext value={words}>
      <div
        className={["sa-pagecal", pickedDate ? "sa-pagecal--open" : null, className ?? null]
          .filter(Boolean)
          .join(" ")}
        style={themeStyle(calendar.theme)}
        lang={language}
        role="group"
        aria-labelledby={title ? titleId : undefined}
      >
        {title && (
          <div className="sa-pagecal-head" id={titleId}>
            {title}
          </div>
        )}
        <div className="sa-pagecal-body">
          {/* The left page on a computer: the month, and under it how it books. */}
          <div className="sa-pagecal-month">
            <MonthCalendarView
              month={shownMonth}
              bounds={bounds}
              freeDays={freeDays}
              pickedDate={pickedDate}
              onPickDate={(date) => void pickDate(date)}
              onMonth={changeMonth}
            />
            {zoneLine && (
              <p className="sa-tz">{words.timesIn(formatZoneName(timeZone, language))}</p>
            )}
            {!pickedDate && monthRead && freeDays.size === 0 && shownMonth < bounds.lastMonth && (
              <button type="button" className="sa-go" onClick={() => changeMonth(1)}>
                {words.nextMonth}
              </button>
            )}
          </div>

          {/* The right page on a computer, under the month on a phone: the service and the day's times. */}
          {pickedDate && (
            <div className="sa-pagecal-day" ref={dayRef} tabIndex={-1}>
              <div className="sa-pagecal-service">
                <span className="sa-pagecal-service-name">{service.name}</span>
                <span className="sa-pagecal-service-facts">
                  {words.minutes(service.durationMinutes)}
                  {price && ` · ${price}`}
                </span>
                {service.description && (
                  <span className="sa-pagecal-service-line">{service.description}</span>
                )}
              </div>
              {dayTimes?.state === "ok" &&
                dayTimes.times.length === 0 &&
                nextOpenDay(pickedDate) && (
                  <button
                    type="button"
                    className="sa-go"
                    onClick={() => void pickDate(nextOpenDay(pickedDate)!, true)}
                  >
                    {words.nextOpenDay}
                  </button>
                )}
              {dayTimes?.state === "ok" && dayTimes.times.length > 0 && (
                <DayTimesView
                  date={pickedDate}
                  times={dayTimes.times}
                  pickedTime={picked?.startsAt ?? null}
                  onPickTime={(startsAt) => {
                    const time = dayTimes.times.find((t) => t.startsAt === startsAt);
                    if (time) setPicked({ startsAt, date: time.date, time: time.time });
                  }}
                  onNext={() => picked && open(service.id, picked)}
                  onBackToCalendar={() => {
                    setPickedDate(null);
                    setDayTimes(null);
                    setPicked(null);
                  }}
                />
              )}
            </div>
          )}
        </div>
        <p className="sa-pagecal-status" role="status">
          {status}
        </p>
        {(bookLabel || ask) && (
          <div className="sa-pagecal-actions">
            {bookLabel && (
              <button
                type="button"
                className="sa-pagecal-book"
                onClick={() => open(service.id, picked ?? undefined)}
              >
                {bookLabel}
              </button>
            )}
            {ask && (
              <button type="button" className="sa-pagecal-ask" onClick={ask.onAsk}>
                {ask.label}
              </button>
            )}
          </div>
        )}
      </div>
    </BookingWordsContext>
  );
}
