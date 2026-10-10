// Frontend component: the business's card of hours on Settings: its week, one-off dates, notice,
// how far ahead customers can book, and its time zone, with one Save (feature 12a).

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import {
  businessHoursValidationSchema,
  type BusinessHoursType,
} from "@scheduleads-app/shared/zod-validation";

import { HoursNotice, type HoursNoticeType } from "@/components/settings/hours-notice";
import { NoticeField } from "@/components/settings/notice-field";
import { OneOffDatesEditor } from "@/components/settings/one-off-dates-editor";
import { WeekEditor } from "@/components/settings/week-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveBusinessHours } from "@/lib/api-client/settings/save-business-hours";
import { useFocusFirstInvalid } from "@/lib/use-focus-first-invalid";

// A business with no hours yet starts empty but for how far ahead: one month, the one value the
// plan pre-fills. The time zone and notice are the owner's to pick.
const NO_HOURS_YET: BusinessHoursType = {
  weeklyHours: {},
  dateHours: [],
  timezone: "",
  minimumNoticeMinutes: Number.NaN,
  horizonDays: 30,
};

export function BusinessHoursCard({
  initial,
  canEdit,
  onSaved,
}: {
  initial: BusinessHoursType | null;
  canEdit: boolean;
  onSaved: (business: BusinessHoursType) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstInvalid = useFocusFirstInvalid(formRef);
  const [notice, setNotice] = useState<HoursNoticeType>(null);
  const form = useForm<z.input<typeof businessHoursValidationSchema>, unknown, BusinessHoursType>({
    resolver: zodResolver(businessHoursValidationSchema),
    defaultValues: initial ?? NO_HOURS_YET,
  });

  // The saved or failed message clears on the next edit.
  const edited =
    <Value,>(onChange: (value: Value) => void) =>
    (value: Value) => {
      setNotice(null);
      onChange(value);
    };

  // Every zone this browser knows, plus the saved one in case this browser does not.
  const savedZone = initial?.timezone;
  const timeZones = useMemo(() => {
    const zones = Intl.supportedValuesOf("timeZone");
    return savedZone && !zones.includes(savedZone) ? [savedZone, ...zones] : zones;
  }, [savedZone]);

  async function saveHours(hours: BusinessHoursType) {
    const saved = await saveBusinessHours(hours);
    if (saved.state === "ok") {
      form.reset(saved.answer.business);
      onSaved(saved.answer.business);
      setNotice({ tone: "info", text: "Saved. Customers can book these hours now." });
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

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-md)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          When you take bookings
        </h2>
        {initial ? (
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {initial.timezone}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {initial
          ? "The hours customers can book online. Everyone follows this week unless their own card says otherwise."
          : "Set your hours. Until you do, customers cannot book online."}
      </p>

      <form
        ref={formRef}
        noValidate
        onSubmit={(event) => form.handleSubmit(saveHours, () => focusFirstInvalid())(event)}
        className="mt-4"
      >
        <fieldset disabled={!canEdit} className="flex flex-col gap-6">
          <Controller
            name="weeklyHours"
            control={form.control}
            render={({ field }) => (
              <WeekEditor
                idBase="business-week"
                week={field.value}
                onChange={edited(field.onChange)}
                errors={errors.weeklyHours as Parameters<typeof WeekEditor>[0]["errors"]}
              />
            )}
          />

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground">One-off dates</h3>
            <Controller
              name="dateHours"
              control={form.control}
              render={({ field }) => (
                <OneOffDatesEditor
                  idBase="business-date"
                  dates={field.value ?? []}
                  onChange={edited(field.onChange)}
                  errors={errors.dateHours as Parameters<typeof OneOffDatesEditor>[0]["errors"]}
                />
              )}
            />
          </div>

          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
            <Controller
              name="minimumNoticeMinutes"
              control={form.control}
              render={({ field, fieldState }) => (
                <NoticeField
                  id="business-notice"
                  minutes={field.value}
                  onChange={edited(field.onChange)}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="horizonDays"
              control={form.control}
              render={({ field, fieldState }) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="business-horizon">How far ahead, in days</Label>
                  <Input
                    id="business-horizon"
                    type="number"
                    min={1}
                    max={365}
                    value={Number.isNaN(field.value) ? "" : field.value}
                    onChange={(event) =>
                      edited(field.onChange)(
                        event.target.value === "" ? Number.NaN : Number(event.target.value)
                      )
                    }
                    aria-invalid={fieldState.error ? true : undefined}
                    aria-describedby={fieldState.error ? "business-horizon-error" : undefined}
                    className="h-10 bg-muted px-3"
                  />
                  {fieldState.error ? (
                    <p id="business-horizon-error" className="text-xs text-destructive">
                      {fieldState.error.message}
                    </p>
                  ) : null}
                </div>
              )}
            />
            <Controller
              name="timezone"
              control={form.control}
              render={({ field, fieldState }) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="business-timezone">Time zone</Label>
                  <select
                    id="business-timezone"
                    value={field.value}
                    onChange={(event) => edited(field.onChange)(event.target.value)}
                    aria-invalid={fieldState.error ? true : undefined}
                    aria-describedby={fieldState.error ? "business-timezone-error" : undefined}
                    className="h-10 rounded-lg border border-input bg-muted px-3 text-sm aria-invalid:border-destructive"
                  >
                    <option value="">Pick a time zone</option>
                    {timeZones.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                  {fieldState.error ? (
                    <p id="business-timezone-error" className="text-xs text-destructive">
                      {fieldState.error.message}
                    </p>
                  ) : null}
                </div>
              )}
            />
          </div>
          <p className="-mt-3 text-xs text-muted-foreground">
            Notice and how far ahead apply to every service: a customer can never book sooner than
            the notice or further ahead than this.
          </p>
        </fieldset>

        <HoursNotice notice={notice} />
        {canEdit ? (
          <div className="mt-4">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : "Save hours"}
            </Button>
          </div>
        ) : null}
      </form>
    </section>
  );
}
