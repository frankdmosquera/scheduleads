// Booking component: the month, its arrows and its days. A day with a free time is tinted and can
// be picked; the others are shown but cannot. Today carries a dot.

import type { BookableMonthsType } from "../../month-calendar/bookable-months.js";
import { capitalized } from "@scheduleads-app/shared/booking-time";

import { formatDayName } from "../../month-calendar/format-day-name.js";
import { formatMonthName } from "../../month-calendar/format-month-name.js";
import { monthGrid } from "../../month-calendar/month-grid.js";
import { useBookingWords } from "../../../words/booking-words-context.js";

export type MonthCalendarViewPropsType = {
  month: string; // YYYY-MM
  bounds: BookableMonthsType;
  freeDays: Set<string>; // empty while the month loads
  pickedDate: string | null;
  onPickDate(date: string): void;
  onMonth(by: -1 | 1): void;
};

export function MonthCalendarView({
  month,
  bounds,
  freeDays,
  pickedDate,
  onPickDate,
  onMonth,
}: MonthCalendarViewPropsType) {
  const words = useBookingWords();
  return (
    <div>
      <div className="sa-mhead">
        <button
          type="button"
          className="sa-mnav"
          aria-label={words.previousMonth}
          disabled={month <= bounds.firstMonth}
          onClick={() => onMonth(-1)}
        >
          &#8249;
        </button>
        <span className="sa-mtitle" aria-live="polite">
          {capitalized(formatMonthName(month, words.language))}
        </span>
        <button
          type="button"
          className="sa-mnav"
          aria-label={words.nextMonth}
          disabled={month >= bounds.lastMonth}
          onClick={() => onMonth(1)}
        >
          &#8250;
        </button>
      </div>

      <div className="sa-dow" aria-hidden="true">
        {words.weekdays.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div className="sa-month">
        {monthGrid(month).map((date, cell) =>
          date === null ? (
            <span key={`blank-${cell}`} />
          ) : (
            <div
              key={date}
              className="sa-dwrap"
              data-today={date === bounds.today ? "yes" : undefined}
            >
              <button
                type="button"
                className="sa-d"
                data-free={freeDays.has(date) ? "yes" : undefined}
                disabled={!freeDays.has(date)}
                aria-pressed={freeDays.has(date) ? date === pickedDate : undefined}
                aria-label={capitalized(formatDayName(date, words.language))}
                onClick={() => onPickDate(date)}
              >
                {Number(date.slice(8))}
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
