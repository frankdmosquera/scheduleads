// Frontend component: one-off dates, a date with its own windows. A one-off date replaces that
// day's week, and opens it if it is closed.

"use client";

import type { DateHoursType } from "@scheduleads-app/shared/zod-validation";

import {
  DayWindowsEditor,
  type DayWindowsErrorsType,
} from "@/components/settings/day-windows-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DateErrorsType =
  | ({ message?: string } & Record<
      number,
      { date?: { message?: string }; windows?: DayWindowsErrorsType } | undefined
    >)
  | undefined;

export function OneOffDatesEditor({
  idBase,
  labelPrefix,
  dates,
  onChange,
  errors,
}: {
  idBase: string;
  labelPrefix?: string; // a person's name, so their fields read apart from the business's
  dates: DateHoursType;
  onChange: (dates: DateHoursType) => void;
  errors: DateErrorsType;
}) {
  const setEntry = (index: number, entry: DateHoursType[number]) =>
    onChange(dates.map((current, i) => (i === index ? entry : current)));

  return (
    <div className="flex flex-col gap-3">
      {dates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No one-off dates.</p>
      ) : null}
      {dates.map((entry, index) => {
        const dateId = `${idBase}-${index}`;
        const dateError = errors?.[index]?.date?.message;
        return (
          <div
            key={index}
            className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:gap-4"
          >
            <div className="flex w-44 flex-none flex-col gap-1">
              <Input
                id={dateId}
                type="date"
                aria-label={`${labelPrefix ? `${labelPrefix}, o` : "O"}ne-off date ${index + 1}`}
                value={entry.date}
                onChange={(event) => setEntry(index, { ...entry, date: event.target.value })}
                aria-invalid={dateError ? true : undefined}
                aria-describedby={dateError ? `${dateId}-error` : undefined}
                className="h-9 bg-muted"
              />
              {dateError ? (
                <p id={`${dateId}-error`} className="text-xs text-destructive">
                  {dateError}
                </p>
              ) : null}
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${labelPrefix ? `${labelPrefix}, ` : ""}one-off date ${index + 1}`}
                  onClick={() => onChange(dates.filter((_, i) => i !== index))}
                >
                  Remove date
                </Button>
              </div>
            </div>
            <DayWindowsEditor
              idBase={`${dateId}-windows`}
              label={`${labelPrefix ? `${labelPrefix}, ` : ""}${entry.date || `one-off date ${index + 1}`}`}
              windows={entry.windows}
              onChange={(windows) => setEntry(index, { ...entry, windows })}
              errors={errors?.[index]?.windows}
            />
          </div>
        );
      })}
      {errors?.message ? <p className="text-xs text-destructive">{errors.message}</p> : null}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            // A new date starts empty, to be picked, with one window, 9:00 to 5:00, to change.
            onChange([...dates, { date: "", windows: [{ startMinute: 540, endMinute: 1020 }] }])
          }
        >
          + Add a one-off date
        </Button>
      </div>
    </div>
  );
}
