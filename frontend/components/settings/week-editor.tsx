// Frontend component: a week of bookable hours, a row per day: off, or one or more windows.
// One editor for the business's week and every person who keeps their own.

"use client";

import type { WeeklyHoursType } from "@scheduleads-app/shared/zod-validation";

import {
  DayWindowsEditor,
  type DayWindowsErrorsType,
} from "@/components/settings/day-windows-editor";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";
import type { DayKeyType } from "@/lib/dashboard-words/hours-words";

// The week in order, Monday first; each day's name is in the words. The person rows read it too.
export const WEEK_DAYS: readonly DayKeyType[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function WeekEditor({
  idBase,
  labelPrefix,
  week,
  onChange,
  errors,
}: {
  idBase: string;
  labelPrefix?: string; // a person's name, so their fields read apart from the business's
  week: WeeklyHoursType;
  onChange: (week: WeeklyHoursType) => void;
  errors: Partial<Record<DayKeyType, DayWindowsErrorsType>> | undefined;
}) {
  const { hoursWords } = useDashboardWords().words;
  // A day with no windows is off, and is left out of the week rather than kept empty.
  const setDay = (day: DayKeyType, windows: WeeklyHoursType[DayKeyType] | null) => {
    const next = { ...week };
    if (windows && windows.length) next[day] = windows;
    else delete next[day];
    onChange(next);
  };

  return (
    <div className="flex flex-col divide-y divide-border">
      {WEEK_DAYS.map((day) => {
        const name = hoursWords.dayNames[day];
        const windows = week[day] ?? [];
        const open = windows.length > 0;
        const switchId = `${idBase}-${day}`;
        return (
          <div key={day} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-start sm:gap-4">
            <label
              htmlFor={switchId}
              className="flex w-28 flex-none items-center gap-2 pt-1.5 text-sm font-medium"
            >
              <input
                id={switchId}
                type="checkbox"
                checked={open}
                aria-label={labelPrefix ? `${labelPrefix}, ${name}` : undefined}
                onChange={(event) =>
                  // Turning a day on starts it with one window, 9:00 to 5:00, to change.
                  setDay(day, event.target.checked ? [{ startMinute: 540, endMinute: 1020 }] : null)
                }
                className="size-4 accent-[var(--primary)]"
              />
              {name}
            </label>
            {open ? (
              <DayWindowsEditor
                idBase={switchId}
                label={labelPrefix ? `${labelPrefix}, ${name}` : name}
                windows={windows}
                onChange={(next) => setDay(day, next)}
                errors={errors?.[day]}
              />
            ) : (
              <span className="pt-1.5 text-sm text-muted-foreground">{hoursWords.closed}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
