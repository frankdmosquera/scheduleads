// Frontend component: one row of own hours on Settings, opened to edit, with its own Save: when a
// service runs (feature 12k), under the service on the Services page. A person's hours are a part
// of their card on People instead (person-hours-part.tsx); both share the fields.

"use client";

import { dashboardFormResolver } from "@/lib/dashboard-form-resolver";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";

import {
  personHoursValidationSchema,
  type PersonHoursType,
  type WeeklyHoursType,
} from "@scheduleads-app/shared/zod-validation";

import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { ListedBookings, type ListedBookingsType } from "@/components/settings/listed-bookings";
import {
  OwnHoursFields,
  ownHoursLine,
  useOwnHoursWatch,
  type OwnHoursFieldsWordsType,
  type OwnHoursFormType,
} from "@/components/settings/own-hours-fields";
import { Button } from "@/components/ui/button";
import type { SaveResultType } from "@/lib/api-client/settings/read-save-refusal";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";
import { useFocusFirstInvalid } from "@/lib/use-focus-first-invalid";

// What the row says, in the words of whose hours they are.
export type OwnHoursWordsType = OwnHoursFieldsWordsType & {
  ownDays(days: string): string; // the days open, as "Mon, Tue"
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
  const form = useForm<OwnHoursFormType, unknown, PersonHoursType>({
    resolver: dashboardFormResolver(personHoursValidationSchema),
    defaultValues: { weeklyHours: owner.weeklyHours, dateHours: owner.dateHours },
  });

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

  const idBase = `${rowsName}-${owner.id}`;
  // The row reads what the card holds now, saved or not.
  const { week, dates } = useOwnHoursWatch(form.control);

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
          {ownHoursLine(hoursWords, words, week, dates, outside?.bookings.length ?? 0)}
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
        <fieldset disabled={!canEdit}>
          <OwnHoursFields
            control={form.control}
            errors={form.formState.errors}
            idBase={idBase}
            name={owner.name}
            words={words}
            businessWeek={businessWeek}
            onEdit={() => setNotice(null)}
          />
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
