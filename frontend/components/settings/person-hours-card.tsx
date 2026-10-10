// Frontend component: one person's row of hours on Settings, opened to edit: following the
// business's week or keeping their own, and their own one-off dates, with one Save (feature 12a).

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import {
  personHoursValidationSchema,
  type PersonHoursType,
  type WeeklyHoursType,
} from "@scheduleads-app/shared/zod-validation";

import { HoursNotice, type HoursNoticeType } from "@/components/settings/hours-notice";
import { OneOffDatesEditor } from "@/components/settings/one-off-dates-editor";
import {
  OutsideHoursList,
  type OutsideHoursListType,
} from "@/components/settings/outside-hours-list";
import { WeekEditor } from "@/components/settings/week-editor";
import { Button } from "@/components/ui/button";
import type { HoursSettingsType } from "@/lib/api-client/settings/fetch-hours-settings";
import { savePersonHours } from "@/lib/api-client/settings/save-person-hours";
import { useFocusFirstInvalid } from "@/lib/use-focus-first-invalid";

export function PersonHoursCard({
  person,
  businessWeek,
  timezone,
  canEdit,
}: {
  person: HoursSettingsType["people"][number];
  businessWeek: WeeklyHoursType; // copied in when the person starts their own week
  timezone: string; // the business's, for the times of the bookings listed after a save
  canEdit: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstInvalid = useFocusFirstInvalid(formRef);
  const [notice, setNotice] = useState<HoursNoticeType>(null);
  // Stays until the card is saved again or the page is left.
  const [outside, setOutside] = useState<OutsideHoursListType | null>(null);
  const form = useForm<z.input<typeof personHoursValidationSchema>, unknown, PersonHoursType>({
    resolver: zodResolver(personHoursValidationSchema),
    defaultValues: { weeklyHours: person.weeklyHours, dateHours: person.dateHours },
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
    const saved = await savePersonHours(person.id, hours);
    if (saved.state === "ok") {
      const count = saved.answer.outsideHours.length;
      const { weeklyHours, dateHours } = saved.answer.person;
      form.reset({ weeklyHours, dateHours });
      setOutside({ bookings: saved.answer.outsideHours, timezone });
      setNotice({
        tone: "info",
        text: `Saved. ${person.name} can be booked on these hours now.${
          count
            ? ` ${count === 1 ? "One booking now sits" : `${count} bookings now sit`} outside them, listed below.`
            : ""
        }`,
      });
      return;
    }
    if (saved.state === "field") {
      form.setError(saved.field as "weeklyHours", { message: saved.message });
      focusFirstInvalid();
      return;
    }
    setNotice({ tone: "error", text: saved.message });
  }

  const errors = form.formState.errors;
  const idBase = `person-${person.id}`;
  // The row reads what the card holds now, saved or not.
  const [week, dates] = useWatch({ control: form.control, name: ["weeklyHours", "dateHours"] });

  return (
    // One person open at a time: every row shares the name. Closed, it keeps its edits.
    <details name="people" className="group rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl px-4 py-2.5 hover:bg-muted/50 md:px-6 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="text-muted-foreground transition-transform group-open:rotate-90"
        >
          &#9656;
        </span>
        <h4 className="text-base font-semibold tracking-tight text-foreground">{person.name}</h4>
        <span className="text-sm text-muted-foreground">{rowState(week ?? null, dates ?? [])}</span>
        {form.formState.isDirty ? (
          <span className="rounded-md bg-[var(--wait-soft)] px-2 py-0.5 text-xs font-medium text-foreground">
            Not saved
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
                    aria-label={`${person.name}'s week`}
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
                      Follows the business&apos;s week
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`${idBase}-week`}
                        checked={week !== null}
                        onChange={() => edited(onChange)(structuredClone(businessWeek))}
                        className="accent-[var(--primary)]"
                      />
                      Own week
                    </label>
                  </div>
                  {week !== null ? (
                    <WeekEditor
                      idBase={`${idBase}-week`}
                      labelPrefix={person.name}
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
              {person.name}&apos;s one-off dates
            </h5>
            <Controller
              name="dateHours"
              control={form.control}
              render={({ field }) => (
                <OneOffDatesEditor
                  idBase={`${idBase}-date`}
                  labelPrefix={person.name}
                  dates={field.value ?? []}
                  onChange={edited(field.onChange)}
                  errors={errors.dateHours as Parameters<typeof OneOffDatesEditor>[0]["errors"]}
                />
              )}
            />
          </div>
        </fieldset>
        <HoursNotice notice={notice} />
        <OutsideHoursList list={outside} Heading="h5" />
        {canEdit ? (
          <div className="mt-4">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : `Save ${person.name}'s hours`}
            </Button>
          </div>
        ) : null}
      </form>
    </details>
  );
}

const DAYS: [keyof WeeklyHoursType, string][] = [
  ["mon", "Mon"],
  ["tue", "Tue"],
  ["wed", "Wed"],
  ["thu", "Thu"],
  ["fri", "Fri"],
  ["sat", "Sat"],
  ["sun", "Sun"],
];

// The row's line: "Follows the business's week", or "Own week · Mon, Tue", then any one-off dates.
function rowState(week: WeeklyHoursType | null, dates: unknown[]): string {
  const weekText = week
    ? `Own week · ${
        DAYS.filter(([day]) => week[day]?.length)
          .map(([, label]) => label)
          .join(", ") || "no days"
      }`
    : "Follows the business's week";
  if (dates.length === 0) return weekText;
  return `${weekText} · ${dates.length === 1 ? "1 one-off date" : `${dates.length} one-off dates`}`;
}
