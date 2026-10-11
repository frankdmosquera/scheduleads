// Frontend component: the form that opens a closed day again on the Days off page (feature 12e),
// for everyone or for one person, on their usual hours for that weekday.

"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { ChoiceField } from "@/components/settings/choice-field";
import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { Button } from "@/components/ui/button";
import type {
  ClosedDaySettingsType,
  DaysOffSettingsType,
} from "@/lib/api-client/settings/fetch-days-off";
import { openClosedDay, type OpenedClosedDayType } from "@/lib/api-client/settings/save-days-off";
import { useFocusFirstInvalid } from "@/lib/use-focus-first-invalid";

const EVERYONE = "everyone"; // never a person's id, which is a UUID

export function OpenDayForm({
  day,
  dayName,
  people,
  onOpened,
  onCancel,
}: {
  day: ClosedDaySettingsType;
  dayName: string; // "Monday, November 2, 2026"
  people: DaysOffSettingsType["people"];
  onOpened: (answer: OpenedClosedDayType, forWhom: string) => void; // "everyone" or a name
  onCancel: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstInvalid = useFocusFirstInvalid(formRef);
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  const form = useForm<{ forWhom: string }>(); // unpicked: the owner says who
  // The form opens where the owner picks: the button that opened it is gone from the page.
  useEffect(() => formRef.current?.querySelector<HTMLElement>("[role=radiogroup]")?.focus(), []);
  const choices = [
    { value: EVERYONE, label: "Everyone" },
    ...people
      .filter((person) => !day.openedFor.includes(person.id))
      .map((person) => ({ value: person.id, label: person.name })),
  ];

  async function open({ forWhom }: { forWhom: string }) {
    const opened = await openClosedDay({
      date: day.date,
      personId: forWhom === EVERYONE ? null : forWhom,
    });
    if (opened.state === "ok") {
      const person = people.find((candidate) => candidate.id === forWhom);
      onOpened(opened.answer, person?.name ?? "everyone");
      return;
    }
    setNotice({ tone: "error", text: opened.message });
  }

  const titleId = `open-day-${day.date}-title`;
  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => form.handleSubmit(open, () => focusFirstInvalid())(event)}
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-md)] md:p-6"
    >
      <h3 id={titleId} className="text-base font-semibold tracking-tight text-foreground">
        Open {dayName} again
      </h3>
      <Controller
        name="forWhom"
        control={form.control}
        rules={{ required: "Pick who it opens for." }}
        render={({ field, fieldState }) => (
          <ChoiceField
            name={`open-day-${day.date}-for`}
            legend="Open it for, on their usual hours for that weekday"
            choices={choices}
            value={field.value}
            onChange={(forWhom) => {
              setNotice(null);
              field.onChange(forWhom);
            }}
            error={fieldState.error?.message}
          />
        )}
      />
      <SaveNotice notice={notice} />
      <div className="flex gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Opening…" : "Open the day"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
