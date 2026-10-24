// Frontend component: the business's text choices on the Texts page (feature 12g): whether the
// confirmation goes, its reminders, and where a customer's reply is passed on. The texting number
// is shown, never changed here. One Save writes the lot; a reminder added also reaches the
// bookings already made.

"use client";

import { useEffect, useRef, useState } from "react";

import { TEXT_REMINDERS_MAX } from "@scheduleads-app/shared/zod-validation";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { ChoiceField } from "@/components/settings/choice-field";
import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TextsSettingsType } from "@/lib/api-client/settings/fetch-texts";
import { saveTexts } from "@/lib/api-client/settings/save-texts";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";
import type { TextsWordsType } from "@/lib/dashboard-words/texts-words";
import { useFocusFirstInvalid } from "@/lib/use-focus-first-invalid";

type TextsType = NonNullable<TextsSettingsType["texts"]>;
type UnitType = "minutes" | "hours" | "days";

const MINUTES_IN: Record<UnitType, number> = { minutes: 1, hours: 60, days: 1440 };
const MOST_MINUTES = 2_147_483_647; // the most a reminder can hold

// "20 hours before", in the largest whole unit.
function reminderWords(minutes: number, words: TextsWordsType): string {
  if (minutes % 1440 === 0) return words.reminderBefore(minutes / 1440, "day");
  if (minutes % 60 === 0) return words.reminderBefore(minutes / 60, "hour");
  return words.reminderBefore(minutes, "minute");
}

export function TextsForm({ texts, canEdit }: { texts: TextsType; canEdit: boolean }) {
  const { words } = useDashboardWords();
  const textsWords = words.textsWords;
  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstInvalid = useFocusFirstInvalid(formRef);
  const [confirmationOn, setConfirmationOn] = useState(texts.confirmationOn);
  const [reminders, setReminders] = useState(texts.reminderMinutesBefore);
  const [replyPhone, setReplyPhone] = useState(texts.replyPhone ?? "");
  const [replyEmail, setReplyEmail] = useState(texts.replyEmail ?? "");
  const [count, setCount] = useState("");
  const [unit, setUnit] = useState<UnitType>("hours");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  const [saving, setSaving] = useState(false);
  // After a remove the pressed button is gone: focus goes to the next one, or to the new reminder;
  // after a refused list, to the list.
  const focusNext = useRef<string | null>(null);

  useEffect(() => {
    if (!focusNext.current) return;
    formRef.current?.querySelector<HTMLElement>(`[data-focus="${focusNext.current}"]`)?.focus();
    focusNext.current = null;
  }, [reminders, errors]);

  const edited = () => {
    setNotice(null);
    setErrors({});
  };

  function addReminder() {
    edited();
    const amount = Number(count);
    const minutes = amount * MINUTES_IN[unit];
    if (!Number.isInteger(amount) || amount < 1) {
      setErrors({ newReminder: textsWords.wholeNumber });
      return;
    }
    if (minutes > MOST_MINUTES) {
      setErrors({ newReminder: textsWords.tooFarAhead });
      return;
    }
    if (reminders.includes(minutes)) {
      setErrors({ newReminder: textsWords.alreadyThere });
      return;
    }
    const next = [...reminders, minutes].sort((a, b) => b - a);
    // The add row goes once the list is full: focus moves to the new reminder's own Remove.
    if (next.length >= TEXT_REMINDERS_MAX) focusNext.current = `remove-${minutes}`;
    setReminders(next);
    setCount("");
  }

  function removeReminder(index: number) {
    edited();
    const next = reminders.filter((_, at) => at !== index);
    const neighbour = next[index] ?? next[index - 1];
    focusNext.current = neighbour === undefined ? "new-reminder" : `remove-${neighbour}`;
    setReminders(next);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A reminder typed and not added would be lost without a word.
    if (count.trim() !== "") {
      setErrors({ newReminder: textsWords.addOrClearFirst });
      focusFirstInvalid();
      return;
    }
    setSaving(true);
    const saved = await saveTexts({
      confirmationOn,
      reminderMinutesBefore: reminders,
      replyPhone: replyPhone.trim() || null,
      replyEmail: replyEmail.trim() || null,
    });
    setSaving(false);
    if (saved.state === "ok") {
      const { texts: kept } = saved.answer;
      setReminders(kept.reminderMinutesBefore);
      setReplyPhone(kept.replyPhone ?? "");
      setReplyEmail(kept.replyEmail ?? "");
      setNotice({ tone: "info", text: textsWords.saved });
      return;
    }
    if (saved.state === "field") {
      const field = saved.field.split(".")[0] ?? saved.field;
      setErrors({ [field]: saved.message });
      // The list is a group, which cannot be marked invalid: it takes the focus itself.
      if (field === "reminderMinutesBefore") focusNext.current = "reminders";
      else focusFirstInvalid();
      return;
    }
    setNotice({ tone: "error", text: saved.message });
  }

  // One text box with its label and its error, read out with it.
  const textField = (
    name: "replyPhone" | "replyEmail",
    label: string,
    value: string,
    set: (value: string) => void,
    type: "tel" | "email"
  ) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`texts-${name}`} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Input
        id={`texts-${name}`}
        type={type}
        value={value}
        disabled={!canEdit}
        onChange={(event) => {
          edited();
          set(event.target.value);
        }}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `texts-${name}-error` : undefined}
        className="h-10 bg-muted px-3"
      />
      {errors[name] ? (
        <p id={`texts-${name}-error`} className="text-xs text-destructive">
          {errors[name]}
        </p>
      ) : null}
    </div>
  );

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={save}
      aria-labelledby="texts-title"
      className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h3 id="texts-title" className="text-base font-semibold tracking-tight text-foreground">
          {textsWords.title}
        </h3>
        <p className="text-sm text-muted-foreground">{textsWords.fromNumber(texts.fromNumber)}</p>
      </div>
      {!canEdit ? (
        <CentredCardNotice tone="info">{textsWords.cannotChange}</CentredCardNotice>
      ) : null}

      <fieldset disabled={!canEdit} className="flex flex-col gap-5">
        <ChoiceField
          name="texts-confirmation"
          legend={textsWords.whenCustomerBooks}
          choices={[
            { value: true, label: textsWords.yesSendIt },
            { value: false, label: textsWords.no },
          ]}
          value={confirmationOn}
          onChange={(value) => {
            edited();
            setConfirmationOn(value);
          }}
        />

        <div
          role="group"
          tabIndex={-1}
          aria-labelledby="texts-reminders-label"
          data-focus="reminders"
          aria-describedby={errors.reminderMinutesBefore ? "texts-reminders-error" : undefined}
          className="flex flex-col gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <p id="texts-reminders-label" className="text-sm font-medium text-foreground">
            {textsWords.reminders}
          </p>
          {reminders.length === 0 ? (
            <p className="text-sm text-muted-foreground">{textsWords.noReminders}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {reminders.map((minutes, index) => (
                <li key={minutes} className="flex items-center gap-3">
                  <span>{reminderWords(minutes, textsWords)}</span>
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      data-focus={`remove-${minutes}`}
                      aria-label={textsWords.removeReminder(reminderWords(minutes, textsWords))}
                      onClick={() => removeReminder(index)}
                    >
                      {words.settingsFrameWords.remove}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {errors.reminderMinutesBefore ? (
            <p id="texts-reminders-error" className="text-xs text-destructive">
              {errors.reminderMinutesBefore}
            </p>
          ) : null}
          {canEdit && reminders.length < TEXT_REMINDERS_MAX ? (
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="texts-new-reminder" className="sr-only">
                  {textsWords.newReminderCount}
                </label>
                <Input
                  id="texts-new-reminder"
                  data-focus="new-reminder"
                  inputMode="numeric"
                  value={count}
                  onChange={(event) => {
                    edited();
                    setCount(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    // Enter adds the reminder, never saves the page without it.
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    addReminder();
                  }}
                  aria-invalid={errors.newReminder ? true : undefined}
                  aria-describedby={errors.newReminder ? "texts-new-reminder-error" : undefined}
                  className="h-10 w-24 bg-muted px-3"
                />
                <label htmlFor="texts-new-reminder-unit" className="sr-only">
                  {textsWords.newReminderUnit}
                </label>
                <select
                  id="texts-new-reminder-unit"
                  value={unit}
                  onChange={(event) => setUnit(event.target.value as UnitType)}
                  className="h-10 rounded-md border border-border bg-muted px-2 text-sm"
                >
                  <option value="minutes">{textsWords.minutesBefore}</option>
                  <option value="hours">{textsWords.hoursBefore}</option>
                  <option value="days">{textsWords.daysBefore}</option>
                </select>
                <Button type="button" variant="outline" onClick={addReminder}>
                  {textsWords.addReminder}
                </Button>
              </div>
              {errors.newReminder ? (
                <p id="texts-new-reminder-error" className="text-xs text-destructive">
                  {errors.newReminder}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">{textsWords.passRepliesTo}</p>
            <p className="text-xs text-muted-foreground">{textsWords.phoneEmailOrBoth}</p>
          </div>
          {textField("replyPhone", textsWords.phone, replyPhone, setReplyPhone, "tel")}
          {textField("replyEmail", textsWords.email, replyEmail, setReplyEmail, "email")}
        </div>
      </fieldset>

      <SaveNotice notice={notice} />
      {canEdit ? (
        <div>
          <Button type="submit" disabled={saving}>
            {saving ? words.settingsFrameWords.saving : textsWords.saveTexts}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
