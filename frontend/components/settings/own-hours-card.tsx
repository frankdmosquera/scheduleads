// Frontend component: one row of own hours on Settings, opened to edit: following the business's
// week or keeping its own, and its own one-off dates, with one Save. A person's bookable hours
// (feature 12a) and when a service runs (feature 12k) share it; each brings its words and its save.

"use client";

import { dashboardFormResolver } from "@/lib/dashboard-form-resolver";
import { useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import {
  personHoursValidationSchema,
  type PersonHoursType,
  type WeeklyHoursType,
} from "@scheduleads-app/shared/zod-validation";

import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { OneOffDatesEditor } from "@/components/settings/one-off-dates-editor";
import { ListedBookings, type ListedBookingsType } from "@/components/settings/listed-bookings";
import { WEEK_DAYS, WeekEditor } from "@/components/settings/week-editor";
import { Button } from "@/components/ui/button";
import type { SaveResultType } from "@/lib/api-client/settings/read-save-refusal";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";
import type { HoursWordsType } from "@/lib/dashboard-words/hours-words";
import { useFocusFirstInvalid } from "@/lib/use-focus-first-invalid";

// What the row says, in the words of whose hours they are.
export type OwnHoursWordsType = {
  follows: string; // following the business's week
  own: string; // keeping its own
  ownDays(days: string): string; // the days open, as "Mon, Tue"
  weekLabel(name: string): string; // the choice between the two
  datesTitle(name: string): string;
  save(name: string): string;
  saved(name: string, outsideCount: number): string;
  outsideTitle: string;
};

export type SavedOwnHoursType = PersonHoursType & { outsideHours: ListedBookingsType["bookings"] };

export function OwnHoursCard({
  owner,
  rowsName,
  words,
  save,
  businessWeek,
  timezone,
  canEdit,
}: {
  owner: { id: string; name: string } & PersonHoursType;
  rowsName: string; // rows sharing it open one at a time
  words: OwnHoursWordsType;
  save: (hours: PersonHoursType) => Promise<SaveResultType<SavedOwnHoursType>>;
  businessWeek: WeeklyHoursType; // copied in when it starts its own week
  timezone: string; // the business's, for the times of the bookings listed after a save
  canEdit: boolean;
}) {
  const rowRef = useRef<HTMLDetailsElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstInvalid = useFocusFirstInvalid(formRef);
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  const { hoursWords } = useDashboardWords().words;
  // Stays until the card is saved again or the page is left.
  const [outside, setOutside] = useState<ListedBookingsType | null>(null);
  const form = useForm<z.input<typeof personHoursValidationSchema>, unknown, PersonHoursType>({
    resolver: dashboardFormResolver(personHoursValidationSchema),
    defaultValues: { weeklyHours: owner.weeklyHours, dateHours: owner.dateHours },
  });

  // The saved or failed message clears on the next edit.
  const edited =
    <Value,>(onChange: (value: Value) => void) =>
    (value: Value) => {
      setNotice(null);
      onChange(value);
    };

  async function saveHours(hours: PersonHoursType) {
    setOutside(null);
    const saved = await save(hours);
    if (saved.state === "ok") {
      const { weeklyHours, dateHours, outsideHours } = saved.answer;
      form.reset({ weeklyHours, dateHours });
      setOutside({ bookings: outsideHours, timezone });
      setNotice({ tone: "info", text: words.saved(owner.name, outsideHours.length) });
      return;
    }
    // A refusal must be seen, even if another row was opened while the save ran.
    if (rowRef.current) rowRef.current.open = true;
    if (saved.state === "field") {
      form.setError(saved.field as "weeklyHours", { message: saved.message });
      focusFirstInvalid();
      return;
    }
    setNotice({ tone: "error", text: saved.message });
  }

  const errors = form.formState.errors;
  const idBase = `${rowsName}-${owner.id}`;
  // The row reads what the card holds now, saved or not.
  const [week, dates] = useWatch({ control: form.control, name: ["weeklyHours", "dateHours"] });

  return (
    // One row open at a time: every row shares the name. Closed, it keeps its edits.
    <details ref={rowRef} name={rowsName} className="group rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl px-4 py-2.5 hover:bg-muted/50 md:px-6 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="text-muted-foreground transition-transform group-open:rotate-90"
        >
          &#9656;
        </span>
        <h4 className="text-base font-semibold tracking-tight text-foreground">{owner.name}</h4>
        <span className="text-sm text-muted-foreground">
          {rowState(hoursWords, words, week ?? null, dates ?? [], outside?.bookings.length ?? 0)}
        </span>
        {form.formState.isDirty ? (
          <span className="rounded-md bg-[var(--wait-soft)] px-2 py-0.5 text-xs font-medium text-foreground">
            {hoursWords.notSaved}
          </span>
        ) : null}
      </summary>
      <form
        ref={formRef}
        noValidate
        onSubmit={(event) => form.handleSubmit(saveHours, () => focusFirstInvalid())(event)}
        className="px-4 pb-4 md:px-6 md:pb-6"
      >
        <fieldset disabled={!canEdit} className="flex flex-col gap-4">
          <Controller
            name="weeklyHours"
            control={form.control}
            render={({ field: { value, onChange } }) => {
              const week = value ?? null;
              return (
                <div className="flex flex-col gap-3">
                  <div
                    role="radiogroup"
                    aria-label={words.weekLabel(owner.name)}
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
                      labelPrefix={owner.name}
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
            <h5 className="text-sm font-semibold text-foreground">
              {words.datesTitle(owner.name)}
            </h5>
            <Controller
              name="dateHours"
              control={form.control}
              render={({ field }) => (
                <OneOffDatesEditor
                  idBase={`${idBase}-date`}
                  labelPrefix={owner.name}
                  dates={field.value ?? []}
                  onChange={edited(field.onChange)}
                  errors={errors.dateHours as Parameters<typeof OneOffDatesEditor>[0]["errors"]}
                />
              )}
            />
          </div>
        </fieldset>
        <SaveNotice notice={notice} />
        <ListedBookings list={outside} title={words.outsideTitle} Heading="h5" />
        {canEdit ? (
          <div className="mt-4">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? hoursWords.saving : words.save(owner.name)}
            </Button>
          </div>
        ) : null}
      </form>
    </details>
  );
}

// The row's line: "Follows the business's week", or "Own week · Mon, Tue", then any one-off
// dates, and the bookings the last save left outside, so a closed row still says they are there.
function rowState(
  hoursWords: HoursWordsType,
  words: OwnHoursWordsType,
  week: WeeklyHoursType | null,
  dates: unknown[],
  outsideCount: number
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
