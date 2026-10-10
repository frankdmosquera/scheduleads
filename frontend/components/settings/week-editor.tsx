// Frontend component: a week of bookable hours, a row per day: off, or one or more windows.
// One editor for the business's week and every person who keeps their own.

"use client";

import type { WeeklyHoursType } from "@scheduleads-app/shared/zod-validation";

import {
  DayWindowsEditor,
  type DayWindowsErrorsType,
} from "@/components/settings/day-windows-editor";

const DAYS = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"],
] as const;

type DayKeyType = (typeof DAYS)[number][0];

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
  // A day with no windows is off, and is left out of the week rather than kept empty.
  const setDay = (day: DayKeyType, windows: WeeklyHoursType[DayKeyType] | null) => {
    const next = { ...week };
    if (windows && windows.length) next[day] = windows;
    else delete next[day];
    onChange(next);
  };

  return (
    <div className="flex flex-col divide-y divide-border">
      {DAYS.map(([day, name]) => {
        const windows = week[day] ?? [];
        const open = windows.length > 0;
        const switchId = `${idBase}-${day}`;
        return (
          <div key={day} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4">
            <label
              htmlFor={switchId}
              className="flex w-36 flex-none items-center gap-2 pt-1.5 text-sm font-medium"
            >
              <input
                id={switchId}
                type="checkbox"
                checked={open}
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
              <span className="pt-1.5 text-sm text-muted-foreground">Closed</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
