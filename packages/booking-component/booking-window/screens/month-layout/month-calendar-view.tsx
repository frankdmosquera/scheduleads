// Booking component: the month, its arrows and its days. A day with a free time is tinted and can
// be picked; the others are shown but cannot. Today carries a dot.

import type { BookableMonthsType } from "../../month-calendar/bookable-months.js";
import { formatDayName } from "../../month-calendar/format-day-name.js";
import { formatMonthName } from "../../month-calendar/format-month-name.js";
import { monthGrid } from "../../month-calendar/month-grid.js";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
  return (
    <div>
      <div className="sa-mhead">
        <button
          type="button"
          className="sa-mnav"
          aria-label="Previous month"
          disabled={month <= bounds.firstMonth}
          onClick={() => onMonth(-1)}
        >
          &#8249;
        </button>
        <span className="sa-mtitle" aria-live="polite">
          {formatMonthName(month)}
        </span>
        <button
          type="button"
          className="sa-mnav"
          aria-label="Next month"
          disabled={month >= bounds.lastMonth}
          onClick={() => onMonth(1)}
        >
          &#8250;
        </button>
      </div>

      <div className="sa-dow" aria-hidden="true">
        {weekdays.map((weekday) => (
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
                aria-label={formatDayName(date)}
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
