// Booking component: the picked day's free times. Picking one does not commit: it splits into the
// time and Next, so moving on is a deliberate second press. On a phone the day's times are their
// own screen (feature 12i), with a way back to the calendar that a big screen never shows.

"use client";

import { capitalized } from "@scheduleads-app/shared/booking-time";
import { useEffect, useRef } from "react";

import type { BookingStartTimeType } from "../../../api-client/booking-api-types.js";
import { useBookingWords } from "../../../words/booking-words-context.js";
import { formatDayName } from "../../month-calendar/format-day-name.js";

export type DayTimesViewPropsType = {
  date: string;
  times: BookingStartTimeType[]; // in order, each with its clock time as the API sent it
  pickedTime: string | null;
  onPickTime(startsAt: string): void;
  onNext(): void;
  onBackToCalendar(): void;
};

export function DayTimesView({
  date,
  times,
  pickedTime,
  onPickTime,
  onNext,
  onBackToCalendar,
}: DayTimesViewPropsType) {
  const nextRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const words = useBookingWords();
  const dayName = formatDayName(date, words.language);

  useEffect(() => {
    if (pickedTime) nextRef.current?.focus(); // the button pressed was replaced by the split
  }, [pickedTime]);

  // On a phone the day button pressed is gone with the calendar: focus lands on the way back.
  // A big screen never shows that button, so its focus stays where it was.
  useEffect(() => {
    const back = backRef.current;
    if (back && back.offsetParent !== null) back.focus();
  }, [date]);

  return (
    <div className="sa-times sa-times--day">
      <button ref={backRef} type="button" className="sa-times-back" onClick={onBackToCalendar}>
        &#8249; {words.backToCalendar}
      </button>
      <div className="sa-times-h">{capitalized(dayName)}</div>
      <div className="sa-times-list">
        {times.map(({ startsAt, time }) => {
          return startsAt === pickedTime ? (
            <div key={startsAt} className="sa-t-split">
              <div className="sa-t-chosen">{time}</div>
              <button
                ref={nextRef}
                type="button"
                className="sa-t-next"
                aria-label={words.nextAt(dayName, time)}
                onClick={onNext}
              >
                {words.next}
              </button>
            </div>
          ) : (
            <button
              key={startsAt}
              type="button"
              className="sa-t"
              onClick={() => onPickTime(startsAt)}
            >
              {time}
            </button>
          );
        })}
      </div>
    </div>
  );
}
