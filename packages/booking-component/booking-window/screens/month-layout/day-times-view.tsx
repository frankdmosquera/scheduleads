// Booking component: the picked day's free times. Picking one does not commit: it splits into the
// time and Next, so moving on is a deliberate second press.

"use client";

import { useEffect, useRef } from "react";

import type { BookingStartTimeType } from "../../../api-client/booking-api-types.js";
import { formatDayName } from "../../month-calendar/format-day-name.js";

export type DayTimesViewPropsType = {
  date: string;
  times: BookingStartTimeType[]; // in order, each with its clock time as the API sent it
  pickedTime: string | null;
  onPickTime(startsAt: string): void;
  onNext(): void;
};

export function DayTimesView({
  date,
  times,
  pickedTime,
  onPickTime,
  onNext,
}: DayTimesViewPropsType) {
  const nextRef = useRef<HTMLButtonElement>(null);
  const dayName = formatDayName(date);

  useEffect(() => {
    if (pickedTime) nextRef.current?.focus(); // the button pressed was replaced by the split
  }, [pickedTime]);

  return (
    <div className="sa-times">
      <div className="sa-times-h">{dayName}</div>
      <div className="sa-times-list">
        {times.map(({ startsAt, time }) => {
          return startsAt === pickedTime ? (
            <div key={startsAt} className="sa-t-split">
              <div className="sa-t-chosen">{time}</div>
              <button
                ref={nextRef}
                type="button"
                className="sa-t-next"
                aria-label={`Next: ${dayName} at ${time}`}
                onClick={onNext}
              >
                Next
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
