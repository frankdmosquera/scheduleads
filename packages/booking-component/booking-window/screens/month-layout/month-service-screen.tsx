// Booking component: the month layout's screen one, pick a time. The rail says whose booking and
// what, and who does it when the customer picks; the panel holds the month and the picked day's
// times, in the business's zone, named (decisions 11 and 12).

"use client";

import { localDate } from "@scheduleads-app/shared/local-date";
import { useMemo, useState } from "react";

import type {
  BookingApiClientType,
  BookingAvailabilityType,
  BookingBusinessType,
  BookingServiceDetailsType,
} from "../../../api-client/booking-api-types.js";
import type { ChosenTimeType, TimePickPlaceType } from "../../booking-screen-type.js";
import { bookableMonths } from "../../month-calendar/bookable-months.js";
import { datesToAsk } from "../../month-calendar/dates-to-ask.js";
import { formatMonthName } from "../../month-calendar/format-month-name.js";
import { formatZoneName } from "../../month-calendar/format-zone-name.js";
import { shiftMonth } from "../../month-calendar/shift-month.js";
import { ProblemMessage } from "../problem-message.js";
import { problemWords } from "../problem-words.js";
import { DayTimesView } from "./day-times-view.js";
import { MonthCalendarView } from "./month-calendar-view.js";
import { MonthRail } from "./month-rail.js";
import { PersonChoice } from "./person-choice.js";
import { useMonthTimes } from "./use-month-times.js";

export type MonthServiceScreenPropsType = {
  apiClient: BookingApiClientType;
  slug: string;
  business: BookingBusinessType;
  service: BookingServiceDetailsType;
  availability: BookingAvailabilityType;
  place: TimePickPlaceType | null; // where the customer was, coming back from screen two
  titleId: string;
  onBack: (() => void) | null; // null when a button named the service: there is no list
  onTimeChosen(chosen: ChosenTimeType): void;
};

export function MonthServiceScreen({
  apiClient,
  slug,
  business,
  service,
  availability,
  place,
  titleId,
  onBack,
  onTimeChosen,
}: MonthServiceScreenPropsType) {
  const timeZone = availability.timezone;
  // Today where the business is, read once: the calendar never starts before it.
  const [today] = useState(() => localDate(new Date(), timeZone));
  const bounds = useMemo(
    () => bookableMonths(today, availability.horizonDays),
    [today, availability.horizonDays]
  );
  const customerPicks = service.personChoice === "customer_picks";

  const [month, setMonth] = useState(() =>
    place && place.month >= bounds.firstMonth && place.month <= bounds.lastMonth
      ? place.month
      : bounds.firstMonth
  );
  const [personId, setPersonId] = useState<string | null>(
    customerPicks ? (place?.personId ?? null) : null
  );
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [pickedTime, setPickedTime] = useState<string | null>(null);

  const { times, people, askAgain } = useMonthTimes({
    apiClient,
    slug,
    bookingLinkId: service.id,
    timeZone,
    dates: datesToAsk(month, bounds),
    personId,
  });

  const days = times.state === "ok" ? times.days : new Map<string, string[]>();
  // The picked day if this month has times on it, else its first day with a time.
  const shownDate = pickedDate && days.has(pickedDate) ? pickedDate : ([...days.keys()][0] ?? null);
  const shownTimes = shownDate ? (days.get(shownDate) ?? []) : [];
  const shownTime = pickedTime && shownTimes.includes(pickedTime) ? pickedTime : null;

  const changeMonth = (by: -1 | 1) => {
    setMonth((current) => shiftMonth(current, by));
    setPickedTime(null);
  };
  const changePerson = (next: string | null) => {
    setPersonId(next);
    setPickedTime(null);
  };

  const panelProblem =
    times.state === "times-unreadable"
      ? { words: times.message, retry: askAgain }
      : times.state === "problem"
        ? {
            words: problemWords[times.problem],
            retry: times.problem === "nothing-to-book" ? null : askAgain,
          }
        : null;

  return (
    <div className="sa-book">
      <MonthRail
        business={business}
        service={service}
        back={onBack ? { label: "Back to services", onBack } : null}
      >
        {customerPicks && people.length > 0 && (
          <PersonChoice people={people} personId={personId} onChange={changePerson} />
        )}
      </MonthRail>

      <div className="sa-panel">
        <h2 className="sa-panel-h" id={titleId} tabIndex={-1}>
          Select a date &amp; time
        </h2>

        {panelProblem ? (
          <ProblemMessage
            words={panelProblem.words}
            retry={panelProblem.retry}
            phone={business.phone}
          />
        ) : (
          <div className="sa-pick">
            <div>
              <MonthCalendarView
                month={month}
                bounds={bounds}
                freeDays={new Set(days.keys())}
                pickedDate={shownDate}
                onPickDate={(date) => {
                  setPickedDate(date);
                  setPickedTime(null);
                }}
                onMonth={changeMonth}
              />
              <p className="sa-tz">Times in {formatZoneName(timeZone)}</p>
            </div>

            {times.state === "loading" ? (
              <p className="sa-loading" role="status">
                Finding times…
              </p>
            ) : shownDate === null ? (
              <div className="sa-times">
                <p className="sa-times-none" role="status">
                  No times left in {formatMonthName(month)}.
                </p>
                {month < bounds.lastMonth && (
                  <button type="button" className="sa-go" onClick={() => changeMonth(1)}>
                    Next month
                  </button>
                )}
              </div>
            ) : (
              <DayTimesView
                date={shownDate}
                times={shownTimes}
                timeZone={timeZone}
                pickedTime={shownTime}
                onPickTime={(startsAt) => {
                  setPickedDate(shownDate);
                  setPickedTime(startsAt);
                }}
                onNext={() => {
                  if (!shownTime) return;
                  onTimeChosen({
                    startsAt: shownTime,
                    personId,
                    personName: people.find((person) => person.id === personId)?.name ?? null,
                    place: { month, personId },
                  });
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
