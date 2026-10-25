// Frontend component: own hours as a part of a card on Settings: a person's bookable hours on
// People (feature 12a) and when a service runs on Services (feature 12k). Whenever the business is
// open, or its own week, and its days that are different. The card's one Save calls `check()`
// before saving anything and `save()` in its turn, so hours are never saved or dropped on their own.

"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import {
  personHoursValidationSchema,
  type PersonHoursType,
  type WeeklyHoursType,
} from "@scheduleads-app/shared/zod-validation";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import type { ListedBookingsType } from "@/components/settings/listed-bookings";
import {
  OwnHoursFields,
  type OwnHoursFieldsWordsType,
  type OwnHoursFormType,
} from "@/components/settings/own-hours-fields";
import type { SaveResultType } from "@/lib/api-client/settings/read-save-refusal";
import { dashboardFormResolver } from "@/lib/dashboard-form-resolver";

export type OwnHoursPartHandleType = {
  check: () => Promise<boolean>; // false when the form shows a mistake, marked and focused
  save: () => Promise<boolean>; // true when saved, or nothing changed; false when refused
  edited: () => boolean; // changed since it opened or last saved
};

export type SavedOwnHoursType = PersonHoursType & { outsideHours: ListedBookingsType["bookings"] };

export const OwnHoursPart = forwardRef<
  OwnHoursPartHandleType,
  {
    idBase: string;
    name: string; // whose hours, for the fields' words
    title: string;
    words: OwnHoursFieldsWordsType;
    hours: PersonHoursType; // no own row: whenever the business is open, no days that differ
    businessWeek: WeeklyHoursType; // copied in when it starts its own week
    save: (hours: PersonHoursType) => Promise<SaveResultType<SavedOwnHoursType>>;
    onSaved: (hours: PersonHoursType, outsideHours: ListedBookingsType["bookings"]) => void;
  }
>(function OwnHoursPart({ idBase, name, title, words, hours, businessWeek, save, onSaved }, ref) {
  const partRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const form = useForm<OwnHoursFormType, unknown, PersonHoursType>({
    resolver: dashboardFormResolver(personHoursValidationSchema),
    defaultValues: { weeklyHours: hours.weeklyHours, dateHours: hours.dateHours },
  });
  // Read while drawing, so the form keeps it current (react-hook-form tracks only what is read).
  const edited = form.formState.isDirty;
  const focusFirstInvalid = () =>
    // After React has drawn the errors, the first part marked invalid takes the focus.
    requestAnimationFrame(() =>
      partRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    );

  useImperativeHandle(ref, () => ({
    edited: () => edited,
    async check() {
      if (!edited) return true;
      const valid = await form.trigger();
      if (!valid) focusFirstInvalid();
      return valid;
    },
    async save() {
      if (!edited) return true;
      let result = true;
      await form.handleSubmit(
        async (values) => {
          const saved = await save(values);
          if (saved.state === "ok") {
            const { weeklyHours, dateHours, outsideHours } = saved.answer;
            form.reset({ weeklyHours, dateHours });
            onSaved({ weeklyHours, dateHours }, outsideHours);
            return;
          }
          result = false;
          if (saved.state === "field") {
            form.setError(saved.field as "weeklyHours", { message: saved.message });
            focusFirstInvalid();
            return;
          }
          setFailed(saved.message);
        },
        () => {
          result = false;
          focusFirstInvalid();
        }
      )();
      return result;
    },
  }));

  return (
    <div
      ref={partRef}
      role="group"
      aria-labelledby={`${idBase}-title`}
      className="flex flex-col gap-3 border-t border-border pt-4"
    >
      <h4 id={`${idBase}-title`} className="text-sm font-semibold text-foreground">
        {title}
      </h4>
      <OwnHoursFields
        control={form.control}
        errors={form.formState.errors}
        idBase={idBase}
        name={name}
        words={words}
        businessWeek={businessWeek}
        onEdit={() => setFailed(null)}
      />
      {failed ? <CentredCardNotice>{failed}</CentredCardNotice> : null}
    </div>
  );
});
