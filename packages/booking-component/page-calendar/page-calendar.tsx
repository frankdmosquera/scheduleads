// Booking component: a calendar on the site's own page (feature 13c). The month comes built into the
// page from fetchPageCalendar, its open days marked; later months and a tapped day's times are read
// live. Picking a time and Next books on the spot (13c.3): the window's own form, then its booked
// line, inside the card. The site's Book button, if it gives one, still opens the window with the
// picked time chosen. Sits inside the site's BookingProvider.

"use client";

import { addDays } from "@scheduleads-app/shared/add-days";
import { localDate } from "@scheduleads-app/shared/local-date";
import { useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import type {
  BookingBusinessType,
  BookingMadeType,
  BookingStartTimeType,
} from "../api-client/booking-api-types.js";
import { fetchFreeTimes } from "../api-client/fetch-free-times.js";
import { fetchServiceList } from "../api-client/fetch-service-list.js";
import { BookingContext, type PickedTimeType } from "../booking-provider/booking-context.js";
import { useBooking } from "../booking-provider/use-booking.js";
import type { BookingFormValuesType } from "../booking-window/booking-form/booking-form-values-type.js";
import { newBookingForm } from "../booking-window/booking-form/new-booking-form.js";
import { bookableMonths } from "../booking-window/month-calendar/bookable-months.js";
import { datesToAsk } from "../booking-window/month-calendar/dates-to-ask.js";
import { formatDayName } from "../booking-window/month-calendar/format-day-name.js";
import { formatMonthName } from "../booking-window/month-calendar/format-month-name.js";
import { formatZoneName } from "../booking-window/month-calendar/format-zone-name.js";
import { shiftMonth } from "../booking-window/month-calendar/shift-month.js";
import { DayTimesView } from "../booking-window/screens/month-layout/day-times-view.js";
import { MonthCalendarView } from "../booking-window/screens/month-layout/month-calendar-view.js";
import { useMonthTimes } from "../booking-window/screens/month-layout/use-month-times.js";
import { BookingFormView } from "../booking-window/screens/booking-form-view.js";
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

// Booking on the spot, once a time is picked and Next pressed (13c.3).
type OnTheSpotType =
  | { step: "loading" }
  | { step: "form"; business: BookingBusinessType }
  | { step: "done"; booking: BookingMadeType; email: string | null };

export function PageCalendar({
  calendar,
  title,
  bookLabel,
  ask,
  zoneLine = true,
  className,
}: PageCalendarPropsType) {
  // useId matches on the server's page and in the browser, and two cards on one page never share it.
  const titleId = useId();
  const dayRef = useRef<HTMLDivElement>(null);
  const booking = useContext(BookingContext);
  if (!booking) throw new Error("<PageCalendar> must be used inside <BookingProvider>.");
  const { apiClient, slug, language, booked } = booking;
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
  // Built once a day, the page cannot know which of the next days have run out of times since: the
  // day's hours ending, or the notice the business needs before a booking. The open days in the
  // next three days are read once in the browser, and one with no time left goes grey like a closed
  // day (Frank, Oct 31). If that empties the month it opened on, it moves on to the next open day's
  // month, unless the visitor has moved already.
  const [soonGone, setSoonGone] = useState<ReadonlySet<string>>(() => new Set());
  const visitorMoved = useRef(false);
  useEffect(() => {
    const last = addDays(today, 2);
    const soon = calendar.openDays.filter((day) => day >= today && day <= last);
    if (soon.length === 0) return;
    let left = false;
    void fetchFreeTimes(apiClient, slug, service.id, {
      from: today,
      to: last,
      personId: null,
      language,
    }).then((answer) => {
      if (left || answer.state !== "ok") return;
      const withTimes = new Set(answer.freeTimes.localStartTimes.map((time) => time.date));
      const gone = new Set(soon.filter((day) => !withTimes.has(day)));
      if (gone.size === 0) return;
      setSoonGone(gone);
      if (visitorMoved.current) return;
      const firstOpen = calendar.openDays.find((day) => day >= today && !gone.has(day));
      setMonth((current) =>
        calendar.openDays.some((day) => day >= today && !gone.has(day) && day.startsWith(current))
          ? current
          : (firstOpen?.slice(0, 7) ?? shiftMonth(current, 1))
      );
    });
    return () => {
      left = true;
    };
  }, [today, calendar.openDays, apiClient, slug, service.id, language]);

  const freeDays = openDaysShown(shownMonth, today, calendar, liveMonth);
  for (const day of soonGone) freeDays.delete(day);
  const monthRead = builtIn || liveMonth.state === "ok";

  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [dayTimes, setDayTimes] = useState<DayTimesType | null>(null);
  const [picked, setPicked] = useState<PickedTimeType | null>(null);
  // Once a day opened, for good: a site that widens the card then keeps it wide through the month arrows.
  const [grown, setGrown] = useState(false);
  const latestAsk = useRef(0); // a tap's answer that arrives after a later tap is dropped
  const [onTheSpot, setOnTheSpot] = useState<OnTheSpotType | null>(null);
  // Made at the first Next and kept, with its key, through a time taken meanwhile, as in the window.
  const [form, setForm] = useState<BookingFormValuesType | null>(null);
  const [frozen, setFrozen] = useState(false); // no Back while a send is unknown, as in the window
  const [taken, setTaken] = useState<string | null>(null);
  const business = useRef<BookingBusinessType | null>(null); // read once, at the first Next
  const spotRef = useRef<HTMLHeadingElement>(null);

  const pickDate = async (date: string, moveFocus = false) => {
    visitorMoved.current = true;
    const tap = ++latestAsk.current;
    setMonth(date.slice(0, 7));
    setPickedDate(date);
    setGrown(true);
    setPicked(null);
    setOnTheSpot(null);
    setTaken(null);
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
    visitorMoved.current = true;
    latestAsk.current++; // a day's times or the business still on its way are for a page left
    setMonth(shiftMonth(shownMonth, by));
    setPickedDate(null);
    setDayTimes(null);
    setPicked(null);
    setOnTheSpot(null);
    setTaken(null);
  };

  // Next on a picked time: the form in the card. The business (its contact rule, its questions) is
  // read once; if it cannot be, the window opens on the same time and says what went wrong.
  const bookHere = async (time: PickedTimeType) => {
    const tap = latestAsk.current; // another day or month meanwhile drops this answer
    setForm((kept) => kept ?? newBookingForm());
    setTaken(null);
    if (!business.current) {
      setOnTheSpot({ step: "loading" });
      const answer = await fetchServiceList(apiClient, slug);
      if (tap !== latestAsk.current) return;
      if (answer.state !== "ok") {
        setOnTheSpot(null);
        open(service.id, time);
        return;
      }
      business.current = answer.business;
    }
    setOnTheSpot({ step: "form", business: business.current });
  };

  // While a booking is on its way or its answer unknown, nothing else in the card can be picked:
  // leaving the form would drop its lock, and the same key could be sent for another time (F-607).
  const pickDateNow = (date: string) => {
    if (!frozen) void pickDate(date);
  };
  const changeMonthNow = (by: -1 | 1) => {
    if (!frozen) changeMonth(by);
  };

  // The heading of what replaced the times takes the focus: the Next pressed is gone.
  const spotStep = onTheSpot?.step;
  useEffect(() => {
    if (spotStep === "form" || spotStep === "done") spotRef.current?.focus();
  }, [spotStep]);

  // The next open day after one that filled since the page was built.
  const nextOpenDay = (date: string) =>
    [...calendar.openDays, ...freeDays].filter((day) => day > date).sort()[0] ?? null;

  // One status line, always there, so a screen reader hears each change (F-604).
  const status = onTheSpot
    ? onTheSpot.step === "loading"
      ? words.loading
      : ""
    : pickedDate
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

  // The way on, right under the line that says why: the next open day after a day with no times
  // left, or the next month after one with no open day.
  const nextDay =
    pickedDate && !onTheSpot && dayTimes?.state === "ok" && dayTimes.times.length === 0
      ? nextOpenDay(pickedDate)
      : null;
  const goOn = nextDay
    ? { label: words.nextOpenDay, go: () => void pickDate(nextDay, true) }
    : !pickedDate && monthRead && freeDays.size === 0 && shownMonth < bounds.lastMonth
      ? { label: words.nextMonth, go: () => changeMonthNow(1) }
      : null;

  return (
    <BookingWordsContext value={words}>
      <div
        className={[
          "sa-pagecal",
          pickedDate ? "sa-pagecal--open" : null,
          grown ? "sa-pagecal--grown" : null,
          onTheSpot ? "sa-pagecal--booking" : null,
          className ?? null,
        ]
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
          {/* Inert while a booking is on its way: see pickDateNow. */}
          <div className="sa-pagecal-month" inert={frozen}>
            <MonthCalendarView
              month={shownMonth}
              bounds={bounds}
              freeDays={freeDays}
              pickedDate={pickedDate}
              onPickDate={pickDateNow}
              onMonth={changeMonthNow}
            />
            {zoneLine && (
              <p className="sa-tz">{words.timesIn(formatZoneName(timeZone, language))}</p>
            )}
          </div>

          {/* The right page on a computer, under the month on a phone: one line naming the service, then
              the day's times, or once Next is pressed the form, then the booking made (13c.3). */}
          {pickedDate && (
            <div className="sa-pagecal-day" ref={dayRef} tabIndex={-1}>
              <div className="sa-pagecal-service">
                <span className="sa-pagecal-service-name">{service.name}</span>
                <span className="sa-pagecal-service-facts">
                  {" · "}
                  {words.minutes(service.durationMinutes)}
                  {price && ` · ${price}`}
                </span>
              </div>
              {onTheSpot?.step === "form" && picked && form && (
                <div className="sa-pagecal-spot">
                  {!frozen && (
                    <button
                      type="button"
                      className="sa-pagecal-spot-back"
                      onClick={() => {
                        setOnTheSpot(null);
                        requestAnimationFrame(() => dayRef.current?.focus()); // Back itself is gone
                      }}
                    >
                      &#8249; {words.backToTimes}
                    </button>
                  )}
                  <p className="sa-pagecal-spot-time">
                    {picked.time}, {formatDayName(picked.date, language)}
                    <br />
                    <span className="sa-pagecal-spot-zone">
                      {formatZoneName(timeZone, language)}
                    </span>
                  </p>
                  <h3 className="sa-pagecal-spot-h" ref={spotRef} tabIndex={-1}>
                    {words.yourDetails}
                  </h3>
                  <BookingFormView
                    apiClient={apiClient}
                    slug={slug}
                    business={onTheSpot.business}
                    choice={{
                      bookingLinkId: service.id,
                      startsAt: picked.startsAt,
                      personId: null,
                      addressMode: service.addressMode,
                      language,
                    }}
                    form={form}
                    onFormChange={setForm}
                    onBooked={(made, email) => {
                      setOnTheSpot({ step: "done", booking: made, email });
                      setForm(null); // a next booking from the card is a new one, with its own key
                      booked(made);
                    }}
                    onTimeTaken={(message) => {
                      // Back on the same day, read again without the taken time; the form is kept.
                      void pickDate(pickedDate, true);
                      setTaken(message);
                    }}
                    onFrozenChange={setFrozen}
                  />
                </div>
              )}
              {onTheSpot?.step === "done" && (
                <div className="sa-pagecal-spot sa-done">
                  <h3 className="sa-pagecal-spot-h" ref={spotRef} tabIndex={-1}>
                    {words.youreBooked}
                  </h3>
                  <p className="sa-pagecal-spot-time">{onTheSpot.booking.when}</p>
                  {onTheSpot.email && (
                    <>
                      <p className="sa-fine">{words.confirmationOnItsWay(onTheSpot.email)}</p>
                      <p className="sa-fine">{words.checkSpamFolder}</p>
                    </>
                  )}
                </div>
              )}
              {!onTheSpot && taken && (
                <p className="sa-notice" role="alert">
                  {taken}
                </p>
              )}
              {!onTheSpot && dayTimes?.state === "ok" && dayTimes.times.length > 0 && (
                <DayTimesView
                  date={pickedDate}
                  times={dayTimes.times}
                  pickedTime={picked?.startsAt ?? null}
                  onPickTime={(startsAt) => {
                    const time = dayTimes.times.find((t) => t.startsAt === startsAt);
                    if (time) setPicked({ startsAt, date: time.date, time: time.time });
                  }}
                  onNext={() => picked && void bookHere(picked)}
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
        {goOn && (
          <button type="button" className="sa-go" onClick={goOn.go}>
            {goOn.label}
            <span aria-hidden="true"> &#8250;</span>
          </button>
        )}
        {(bookLabel || ask) && (
          <div className="sa-pagecal-actions">
            {bookLabel && (
              <button
                type="button"
                className="sa-pagecal-book"
                disabled={frozen}
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
