// Frontend component: the fields of one row of own hours: following the business's week or keeping
// its own, and its own one-off dates. A service's "Runs" card and a person's card on People share
// it; each brings its form, its words and its save.

"use client";

import { Controller, useWatch, type Control, type FieldErrors } from "react-hook-form";
import type { z } from "zod";

import type {
  personHoursValidationSchema,
  WeeklyHoursType,
} from "@scheduleads-app/shared/zod-validation";

import { OneOffDatesEditor } from "@/components/settings/one-off-dates-editor";
import { WEEK_DAYS, WeekEditor } from "@/components/settings/week-editor";
import type { HoursWordsType } from "@/lib/dashboard-words/hours-words";

export type OwnHoursFormType = z.input<typeof personHoursValidationSchema>;

// What the fields say, in the words of whose hours they are.
export type OwnHoursFieldsWordsType = {
  follows: string; // following the business's week
  own: string; // keeping its own
  weekLabel(name: string): string; // the choice between the two
  datesTitle(name: string): string;
};

export function OwnHoursFields({
  control,
  errors,
  idBase,
  name,
  words,
  businessWeek,
  onEdit,
}: {
  control: Control<OwnHoursFormType>;
  errors: FieldErrors<OwnHoursFormType>;
  idBase: string;
  name: string; // whose hours, so their fields read apart from everyone else's
  words: OwnHoursFieldsWordsType;
  businessWeek: WeeklyHoursType; // copied in when it starts its own week
  onEdit: () => void; // a saved or failed message clears on the next edit
}) {
  const edited =
    <Value,>(onChange: (value: Value) => void) =>
    (value: Value) => {
      onEdit();
      onChange(value);
    };

  return (
    <div className="flex flex-col gap-4">
      <Controller
        name="weeklyHours"
        control={control}
        render={({ field: { value, onChange } }) => {
          const week = value ?? null;
          return (
            <div className="flex flex-col gap-3">
              <div
                role="radiogroup"
                aria-label={words.weekLabel(name)}
                className="flex flex-wrap gap-4 text-sm"
              >
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`${idBase}-week`}
                    checked={week === null}
                    onChange={() => edited(onChange)(null)}
                    className="accent-[var(--primary)]"
                  />
                  {words.follows}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`${idBase}-week`}
                    checked={week !== null}
                    onChange={() => edited(onChange)(structuredClone(businessWeek))}
                    className="accent-[var(--primary)]"
                  />
                  {words.own}
                </label>
              </div>
              {week !== null ? (
                <WeekEditor
                  idBase={`${idBase}-week`}
                  labelPrefix={name}
                  week={week}
                  onChange={edited(onChange)}
                  errors={errors.weeklyHours as Parameters<typeof WeekEditor>[0]["errors"]}
                />
              ) : null}
            </div>
          );
        }}
      />
      <div className="flex flex-col gap-2">
        <h5 className="text-sm font-semibold text-foreground">{words.datesTitle(name)}</h5>
        <Controller
          name="dateHours"
          control={control}
          render={({ field }) => (
            <OneOffDatesEditor
              idBase={`${idBase}-date`}
              labelPrefix={name}
              dates={field.value ?? []}
              onChange={edited(field.onChange)}
              errors={errors.dateHours as Parameters<typeof OneOffDatesEditor>[0]["errors"]}
            />
          )}
        />
      </div>
    </div>
  );
}

// The one-line summary of own hours: "Bookable whenever the business is open", or "Own bookable
// hours · Mon, Tue", then any one-off dates and the bookings the last save left outside.
export function ownHoursLine(
  hoursWords: HoursWordsType,
  words: { follows: string; ownDays(days: string): string },
  week: WeeklyHoursType | null,
  dates: unknown[],
  outsideCount = 0
): string {
  const weekText = week
    ? words.ownDays(
        WEEK_DAYS.filter((day) => week[day]?.length)
          .map((day) => hoursWords.dayShortNames[day])
          .join(", ") || hoursWords.noDays
      )
    : words.follows;
  const parts = [weekText];
  if (dates.length) parts.push(hoursWords.oneOffDateCount(dates.length));
  if (outsideCount) parts.push(hoursWords.bookingsOutside(outsideCount));
  return parts.join(" · ");
}

// The fields' own hours, as the summary line reads them while they are being edited.
export function useOwnHoursWatch(control: Control<OwnHoursFormType>) {
  const [week, dates] = useWatch({ control, name: ["weeklyHours", "dateHours"] });
  return { week: week ?? null, dates: dates ?? [] };
}
