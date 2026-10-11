// Frontend component: the business's own booking questions on the Booking form page (feature 12f).
// The owner adds, changes, moves and removes them, or starts from a ready-made set, then saves the
// whole list in its order. A lead keeps its answers whatever happens to a question here.

"use client";

import { useEffect, useRef, useState } from "react";

import { BOOKING_QUESTIONS_MAX } from "@scheduleads-app/shared/zod-validation";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BookingFormSettingsType } from "@/lib/api-client/settings/fetch-booking-form";
import { saveBookingQuestions } from "@/lib/api-client/settings/save-booking-questions";
import { useFocusFirstInvalid } from "@/lib/use-focus-first-invalid";

// A row on the page: a saved question carries its id; `key` keeps React's rows apart while moving.
type QuestionRowType = { key: string; id?: string; label: string; required: boolean };

const rowsOf = (questions: BookingFormSettingsType["questions"]): QuestionRowType[] =>
  questions.map((question) => ({ key: question.id, ...question }));
const labelId = (key: string) => `question-${key}`;

export function BookingQuestionsCard({ settings }: { settings: BookingFormSettingsType }) {
  const { canEdit, presets } = settings;
  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstInvalid = useFocusFirstInvalid(formRef);
  const [rows, setRows] = useState(() => rowsOf(settings.questions));
  // A refused save names one row's words ("questions.2.label"), or the list as a whole.
  const [rowError, setRowError] = useState<{ index: number; message: string } | null>(null);
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  const [saving, setSaving] = useState(false);
  // After a move or a remove the pressed button may be gone or disabled: focus goes to the row's
  // own control at its new place, or the nearest one, once React has drawn the list.
  const focusNext = useRef<string | null>(null);
  const [moved, setMoved] = useState(""); // said by a screen reader

  useEffect(() => {
    if (!focusNext.current) return;
    formRef.current?.querySelector<HTMLElement>(`[data-focus="${focusNext.current}"]`)?.focus();
    focusNext.current = null;
  }, [rows]);

  const edit = (next: QuestionRowType[], said = "") => {
    setNotice(null);
    setRowError(null);
    setMoved(said);
    setRows(next);
  };
  const change = (index: number, fields: Partial<QuestionRowType>) =>
    edit(rows.map((row, at) => (at === index ? { ...row, ...fields } : row)));
  const move = (index: number, by: -1 | 1) => {
    const to = index + by;
    const next = [...rows];
    [next[index], next[to]] = [next[to], next[index]];
    // The same arrow again, unless the row reached the end it points to.
    const atEnd = by === -1 ? to === 0 : to === rows.length - 1;
    const control = (by === -1) !== atEnd ? "up" : "down";
    focusNext.current = `${rows[index].key}:${control}`;
    edit(next, `Moved to position ${to + 1} of ${rows.length}.`);
  };
  const remove = (index: number) => {
    const next = rows.filter((_, at) => at !== index);
    const neighbour = next[index] ?? next[index - 1];
    focusNext.current = neighbour ? `${neighbour.key}:remove` : "add";
    edit(next, "Question removed.");
  };
  const add = () => edit([...rows, { key: crypto.randomUUID(), label: "", required: false }]);
  const startFrom = (set: (typeof presets)[number]) =>
    edit(set.questions.map((question) => ({ key: crypto.randomUUID(), ...question })));

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const saved = await saveBookingQuestions({
      questions: rows.map(({ id, label, required }) => ({ id, label, required })),
    });
    setSaving(false);
    if (saved.state === "ok") {
      setRows(rowsOf(saved.answer.questions));
      setNotice({ tone: "info", text: "Saved the questions." });
      return;
    }
    const at = saved.state === "field" ? /^questions\.(\d+)\.label$/.exec(saved.field) : null;
    if (at) {
      setRowError({ index: Number(at[1]), message: saved.message });
      focusFirstInvalid();
      return;
    }
    setNotice({ tone: "error", text: saved.message });
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={save}
      aria-labelledby="questions-title"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h3 id="questions-title" className="text-base font-semibold tracking-tight text-foreground">
          Your questions
        </h3>
        <p className="text-sm text-muted-foreground">
          Asked after the name, email, phone and address, in this order. At most{" "}
          {BOOKING_QUESTIONS_MAX}. Changing or removing one never changes the answers already given.
        </p>
      </div>
      {!canEdit ? (
        <CentredCardNotice tone="info">
          Your role cannot change the booking form. You can see it here.
        </CentredCardNotice>
      ) : null}

      {rows.length === 0 ? (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">
            No questions: the form asks only the standard ones.
          </p>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              {presets.map((set) => (
                <Button
                  key={set.trade}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => startFrom(set)}
                >
                  Start from the {set.name.toLowerCase()} set
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((row, index) => {
            const error = rowError?.index === index ? rowError.message : null;
            return (
              <li
                key={row.key}
                className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-start"
              >
                <div className="flex flex-1 flex-col gap-1">
                  <label htmlFor={labelId(row.key)} className="sr-only">
                    Question {index + 1}
                  </label>
                  <Input
                    id={labelId(row.key)}
                    value={row.label}
                    disabled={!canEdit}
                    maxLength={200}
                    onChange={(event) => change(index, { label: event.target.value })}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${labelId(row.key)}-error` : undefined}
                    className="h-10 bg-muted px-3"
                  />
                  {error ? (
                    <p id={`${labelId(row.key)}-error`} className="text-xs text-destructive">
                      {error}
                    </p>
                  ) : null}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      aria-label={`Question ${index + 1} must be answered`}
                      checked={row.required}
                      disabled={!canEdit}
                      onChange={(event) => change(index, { required: event.target.checked })}
                      className="size-4 accent-[var(--primary)]"
                    />
                    Must be answered
                  </label>
                </div>
                {canEdit ? (
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={index === 0}
                      data-focus={`${row.key}:up`}
                      aria-label={`Move question ${index + 1} up`}
                      onClick={() => move(index, -1)}
                    >
                      Up
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={index === rows.length - 1}
                      data-focus={`${row.key}:down`}
                      aria-label={`Move question ${index + 1} down`}
                      onClick={() => move(index, 1)}
                    >
                      Down
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      data-focus={`${row.key}:remove`}
                      aria-label={`Remove question ${index + 1}`}
                      onClick={() => remove(index)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      <p role="status" className="sr-only">
        {moved}
      </p>
      <SaveNotice notice={notice} />
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={rows.length >= BOOKING_QUESTIONS_MAX}
            data-focus="add"
            onClick={add}
          >
            + Add a question
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save questions"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
