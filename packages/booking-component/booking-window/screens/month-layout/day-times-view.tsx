// Booking component: the picked day's free times. Picking one does not commit: it splits into the
// time and Next, so moving on is a deliberate second press.

"use client";

import { useEffect, useRef } from "react";

import { formatDayName } from "../../month-calendar/format-day-name.js";
import { formatTimeOfDay } from "../../month-calendar/format-time-of-day.js";

export type DayTimesViewPropsType = {
  date: string;
  times: string[]; // ISO instants, in order
  timeZone: string;
  pickedTime: string | null;
  onPickTime(startsAt: string): void;
  onNext(): void;
};

export function DayTimesView({
  date,
  times,
  timeZone,
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
        {times.map((startsAt) => {
          const time = formatTimeOfDay(startsAt, timeZone);
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
