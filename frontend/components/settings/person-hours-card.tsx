// Frontend component: one person's card of hours on Settings: following the business's week or
// keeping their own, and their own one-off dates, with one Save (feature 12a).

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import {
  personHoursValidationSchema,
  type PersonHoursType,
  type WeeklyHoursType,
} from "@scheduleads-app/shared/zod-validation";

import { HoursNotice, type HoursNoticeType } from "@/components/settings/hours-notice";
import { OneOffDatesEditor } from "@/components/settings/one-off-dates-editor";
import { WeekEditor } from "@/components/settings/week-editor";
import { Button } from "@/components/ui/button";
import type { HoursSettingsType } from "@/lib/api-client/settings/fetch-hours-settings";
import { savePersonHours } from "@/lib/api-client/settings/save-person-hours";
import { useFocusFirstInvalid } from "@/lib/use-focus-first-invalid";

export function PersonHoursCard({
  person,
  businessWeek,
  canEdit,
}: {
  person: HoursSettingsType["people"][number];
  businessWeek: WeeklyHoursType; // copied in when the person starts their own week
  canEdit: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstInvalid = useFocusFirstInvalid(formRef);
  const [notice, setNotice] = useState<HoursNoticeType>(null);
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
    const saved = await savePersonHours(person.id, hours);
    if (saved.state === "ok") {
      const { weeklyHours, dateHours } = saved.answer.person;
      form.reset({ weeklyHours, dateHours });
      setNotice({ tone: "info", text: `Saved. ${person.name} can be booked on these hours now.` });
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

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h3 className="text-base font-semibold tracking-tight text-foreground">{person.name}</h3>
      <form
        ref={formRef}
        noValidate
        onSubmit={(event) => form.handleSubmit(saveHours, () => focusFirstInvalid())(event)}
        className="mt-3"
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
            <h4 className="text-sm font-semibold text-foreground">
              {person.name}&apos;s one-off dates
            </h4>
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
        {canEdit ? (
          <div className="mt-4">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : `Save ${person.name}'s hours`}
            </Button>
          </div>
        ) : null}
      </form>
    </section>
  );
}
