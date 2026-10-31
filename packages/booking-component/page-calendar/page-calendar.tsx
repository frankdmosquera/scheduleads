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
import { themeStyle } from "../booking-window/theme-style.js";
import { BookingWordsContext, wordsOf } from "../words/booking-words-context.js";
import type { PageCalendarDataType } from "./fetch-page-calendar.js";
import { monthIsBuiltIn, openDaysShown } from "./open-days-shown.js";

export type PageCalendarPropsType = {
  calendar: PageCalendarDataType;
  title?: ReactNode; // the card's heading, in the site's words
  bookLabel?: string; // the site's Book button under the calendar; left out, none
  className?: string;
};

type DayTimesType =
  { state: "loading" } | { state: "ok"; times: BookingStartTimeType[] } | { state: "problem" };

export function PageCalendar({ calendar, title, bookLabel, className }: PageCalendarPropsType) {
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

  const pickDate = async (date: string) => {
    const ask = ++latestAsk.current;
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
    if (ask !== latestAsk.current) return;
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

  return (
    <BookingWordsContext value={words}>
      <div
        className={className ? `sa-pagecal ${className}` : "sa-pagecal"}
        style={themeStyle(calendar.theme)}
        lang={language}
      >
        {title && <div className="sa-pagecal-head">{title}</div>}
        <div className="sa-pagecal-body">
          <MonthCalendarView
            month={shownMonth}
            bounds={bounds}
            freeDays={freeDays}
            pickedDate={pickedDate}
            onPickDate={(date) => void pickDate(date)}
            onMonth={changeMonth}
          />
          {!pickedDate && monthRead && freeDays.size === 0 && (
            <div className="sa-times">
              <p className="sa-times-none" role="status">
                {words.noTimesLeftIn(formatMonthName(shownMonth, language))}
              </p>
              {shownMonth < bounds.lastMonth && (
                <button type="button" className="sa-go" onClick={() => changeMonth(1)}>
                  {words.nextMonth}
                </button>
              )}
            </div>
          )}
          {!builtIn && liveMonth.state === "loading" && (
            <p className="sa-loading" role="status">
              {words.findingTimes}
            </p>
          )}

          {pickedDate && dayTimes?.state === "loading" && (
            <p className="sa-loading" role="status">
              {words.findingTimes}
            </p>
          )}
          {pickedDate && dayTimes?.state === "problem" && (
            <p className="sa-times-none" role="status">
              {words.timesUnreadable}
            </p>
          )}
          {pickedDate && dayTimes?.state === "ok" && dayTimes.times.length === 0 && (
            <div className="sa-times">
              <p className="sa-times-none" role="status">
                {words.noTimesLeftOn(formatDayName(pickedDate, language))}
              </p>
              {nextOpenDay(pickedDate) && (
                <button
                  type="button"
                  className="sa-go"
                  onClick={() => void pickDate(nextOpenDay(pickedDate)!)}
                >
                  {words.nextOpenDay}
                </button>
              )}
            </div>
          )}
          {pickedDate && dayTimes?.state === "ok" && dayTimes.times.length > 0 && (
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
          <p className="sa-tz">{words.timesIn(formatZoneName(timeZone, language))}</p>
        </div>
        {bookLabel && (
          <button
            type="button"
            className="sa-pagecal-book"
            onClick={() => open(service.id, picked ?? undefined)}
          >
            {bookLabel}
          </button>
        )}
      </div>
    </BookingWordsContext>
  );
}
