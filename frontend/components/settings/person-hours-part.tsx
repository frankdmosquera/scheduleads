// Frontend component: a person's bookable hours, a part of their card on the People page (feature
// 12a): whenever the business is open, or their own week, and their days that are different. The
// card's one Save calls `check()` before saving anything and `save()` in its turn, so hours are
// never saved or dropped on their own.

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
import { OwnHoursFields, type OwnHoursFormType } from "@/components/settings/own-hours-fields";
import { savePersonHours } from "@/lib/api-client/settings/save-person-hours";
import { dashboardFormResolver } from "@/lib/dashboard-form-resolver";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export type PersonHoursPartHandleType = {
  check: () => Promise<boolean>; // false when the form shows a mistake, marked and focused
  save: () => Promise<boolean>; // true when saved, or nothing changed; false when refused
};

export const PersonHoursPart = forwardRef<
  PersonHoursPartHandleType,
  {
    personId: string;
    personName: string;
    hours: PersonHoursType; // no own row: whenever the business is open, no days that differ
    businessWeek: WeeklyHoursType; // copied in when they start their own week
    onSaved: (hours: PersonHoursType, outsideHours: ListedBookingsType["bookings"]) => void;
  }
>(function PersonHoursPart({ personId, personName, hours, businessWeek, onSaved }, ref) {
  const { peopleWords, hoursWords } = useDashboardWords().words;
  const partRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const form = useForm<OwnHoursFormType, unknown, PersonHoursType>({
    resolver: dashboardFormResolver(personHoursValidationSchema),
    defaultValues: { weeklyHours: hours.weeklyHours, dateHours: hours.dateHours },
  });
  const idBase = `person-hours-${personId}`;
  // Read while drawing, so the form keeps it current (react-hook-form tracks only what is read).
  const edited = form.formState.isDirty;
  const focusFirstInvalid = () =>
    // After React has drawn the errors, the first part marked invalid takes the focus.
    requestAnimationFrame(() =>
      partRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    );

  useImperativeHandle(ref, () => ({
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
          const saved = await savePersonHours(personId, values);
          if (saved.state === "ok") {
            const { weeklyHours, dateHours } = saved.answer.person;
            form.reset({ weeklyHours, dateHours });
            onSaved({ weeklyHours, dateHours }, saved.answer.outsideHours);
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
        {peopleWords.bookableHours}
      </h4>
      <OwnHoursFields
        control={form.control}
        errors={form.formState.errors}
        idBase={idBase}
        name={personName}
        words={{
          follows: hoursWords.followsBusinessWeek,
          own: hoursWords.ownWeek,
          weekLabel: hoursWords.personWeek,
          datesTitle: hoursWords.personOneOffDates,
        }}
        businessWeek={businessWeek}
        onEdit={() => setFailed(null)}
      />
      {failed ? <CentredCardNotice>{failed}</CentredCardNotice> : null}
    </div>
  );
});
