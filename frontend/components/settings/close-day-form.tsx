// Frontend component: the form that closes one day for everyone on the Days off page (feature 12e).
// Closing stops new online bookings only; the bookings already on it stay and are listed.

"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { localDate } from "@scheduleads-app/shared/local-date";

import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DaysOffSettingsType } from "@/lib/api-client/settings/fetch-days-off";
import { saveDaysOff, type SavedDaysOffType } from "@/lib/api-client/settings/save-days-off";
import { useFocusFirstInvalid } from "@/lib/use-focus-first-invalid";

export function CloseDayForm({
  daysOff,
  timezone,
  onClosed,
  onCancel,
}: {
  daysOff: DaysOffSettingsType;
  timezone: string; // the business's, so "today" is its today
  onClosed: (answer: SavedDaysOffType, date: string) => void;
  onCancel: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const focusFirstInvalid = useFocusFirstInvalid(formRef);
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  const form = useForm<{ date: string }>({ defaultValues: { date: "" } });
  const today = localDate(new Date(), timezone);

  useEffect(() => dateRef.current?.focus(), []); // the form opens where the owner will pick

  async function save({ date }: { date: string }) {
    const saved = await saveDaysOff({
      closedDates: [...daysOff.closedDates, date],
      holidayCountry: daysOff.holidayCountry,
      holidayRegion: daysOff.holidayRegion,
      closedHolidays: daysOff.closedHolidays,
    });
    if (saved.state === "ok") {
      onClosed(saved.answer, date);
      return;
    }
    if (saved.state === "field" && saved.field.startsWith("closedDates")) {
      form.setError("date", { message: saved.message });
      focusFirstInvalid();
      return;
    }
    setNotice({ tone: "error", text: saved.message });
  }

  const dateError = form.formState.errors.date?.message;
  const { ref: dateFieldRef, ...dateField } = form.register("date", {
    required: "Pick a date.",
    validate: (date) =>
      date < today
        ? "Pick today or a later date."
        : daysOff.closedDays.some((day) => day.date === date && !day.openedForEveryone)
          ? "That day is already closed."
          : true,
    onChange: () => setNotice(null),
  });

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => form.handleSubmit(save, () => focusFirstInvalid())(event)}
      aria-labelledby="close-day-title"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-md)] md:p-6"
    >
      <h3 id="close-day-title" className="text-base font-semibold tracking-tight text-foreground">
        Close a day
      </h3>
      <p className="text-sm text-muted-foreground">
        Nobody can book online that day. Bookings already made stay, and are listed for you. The
        business&apos;s one-off hours for that date on Hours, if any, are removed.
      </p>
      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <Label htmlFor="close-day-date">Date</Label>
        <Input
          id="close-day-date"
          type="date"
          min={today}
          {...dateField}
          ref={(element) => {
            dateFieldRef(element);
            dateRef.current = element;
          }}
          aria-invalid={dateError ? true : undefined}
          aria-describedby={dateError ? "close-day-date-error" : undefined}
          className="h-10 bg-muted px-3"
        />
        {dateError ? (
          <p id="close-day-date-error" className="text-xs text-destructive">
            {dateError}
          </p>
        ) : null}
      </div>
      <SaveNotice notice={notice} />
      <div className="flex gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Closing…" : "Close the day"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
