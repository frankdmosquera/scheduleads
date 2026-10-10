// Frontend component: one day's windows of bookable hours, each a start and an end, as the
// prototype's "When you take bookings" card draws them. Used for a weekday and a one-off date.

"use client";

import type { TimeWindowType } from "@scheduleads-app/shared/zod-validation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MINUTES_IN_A_DAY = 1440;

// What react-hook-form holds for one day's errors: the day's own (an overlap) and each window's.
export type DayWindowsErrorsType =
  | ({ message?: string } & Record<
      number,
      | { message?: string; startMinute?: { message?: string }; endMinute?: { message?: string } }
      | undefined
    >)
  | undefined;

// Minutes from midnight to the time field's "HH:MM". An end at midnight is the end of the day.
function toTimeValue(minute: number): string {
  const inDay = minute % MINUTES_IN_A_DAY;
  return `${String(Math.floor(inDay / 60)).padStart(2, "0")}:${String(inDay % 60).padStart(2, "0")}`;
}

// "HH:MM" back to minutes. An end of 12:00 am means midnight, the end of the day; an unfinished
// field gives null, and the window keeps its last whole time.
function fromTimeValue(value: string, isEnd: boolean): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const minute = Number(match[1]) * 60 + Number(match[2]);
  return isEnd && minute === 0 ? MINUTES_IN_A_DAY : minute;
}

// A new window starts where the day's last one ends (9:00 on an empty day), an hour long.
function nextWindow(windows: TimeWindowType[]): TimeWindowType | null {
  const start = windows.length ? Math.max(...windows.map((window) => window.endMinute)) : 540;
  if (start >= MINUTES_IN_A_DAY) return null;
  return { startMinute: start, endMinute: Math.min(start + 60, MINUTES_IN_A_DAY) };
}

export function DayWindowsEditor({
  idBase,
  label,
  windows,
  onChange,
  errors,
}: {
  idBase: string;
  label: string; // "Monday", "Nov 2", for each field's accessible name
  windows: TimeWindowType[];
  onChange: (windows: TimeWindowType[]) => void;
  errors: DayWindowsErrorsType;
}) {
  const added = nextWindow(windows);
  // An error on the whole day (two windows overlap, a date with none) marks every field of the day,
  // so a refused save can focus one and a screen reader hears why.
  const dayError = errors?.message;
  const dayErrorId = `${idBase}-error`;
  const setTime = (index: number, key: "startMinute" | "endMinute", value: string) => {
    const minute = fromTimeValue(value, key === "endMinute");
    if (minute === null) return;
    onChange(windows.map((window, i) => (i === index ? { ...window, [key]: minute } : window)));
  };

  return (
    <div className="flex flex-col gap-2">
      {windows.map((window, index) => {
        const error =
          errors?.[index]?.message ??
          errors?.[index]?.startMinute?.message ??
          errors?.[index]?.endMinute?.message;
        const errorId = `${idBase}-${index}-error`;
        const invalid = error || dayError ? true : undefined;
        const describedBy =
          [error ? errorId : null, dayError ? dayErrorId : null].filter(Boolean).join(" ") ||
          undefined;
        return (
          <div key={index} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="time"
                step={300}
                aria-label={`${label}, window ${index + 1}, from`}
                value={toTimeValue(window.startMinute)}
                onChange={(event) => setTime(index, "startMinute", event.target.value)}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className="h-9 w-32 bg-muted"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="time"
                step={300}
                aria-label={`${label}, window ${index + 1}, until`}
                value={toTimeValue(window.endMinute)}
                onChange={(event) => setTime(index, "endMinute", event.target.value)}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className="h-9 w-32 bg-muted"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove ${label}, window ${index + 1}`}
                onClick={() => onChange(windows.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            </div>
            {error ? (
              <p id={errorId} className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
      {dayError ? (
        <p id={dayErrorId} className="text-xs text-destructive">
          {dayError}
        </p>
      ) : null}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!added}
          aria-label={`Add a window to ${label}`}
          aria-invalid={dayError && windows.length === 0 ? true : undefined}
          aria-describedby={dayError && windows.length === 0 ? dayErrorId : undefined}
          onClick={() => added && onChange([...windows, added])}
        >
          + Add
        </Button>
      </div>
    </div>
  );
}
