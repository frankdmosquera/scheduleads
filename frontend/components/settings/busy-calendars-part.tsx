// Frontend component: which of the person's Google calendars count as busy (feature 12h), under the
// connection card. Read from Google each time it opens; one Save writes the ticks.

"use client";

import { useEffect, useState } from "react";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { Button } from "@/components/ui/button";
import {
  fetchCalendarChoices,
  type CalendarChoicesResultType,
  type CalendarChoicesType,
} from "@/lib/api-client/calendar/fetch-calendar-choices";
import { saveBusyCalendars } from "@/lib/api-client/calendar/save-busy-calendars";

export function BusyCalendarsPart() {
  const [result, setResult] = useState<CalendarChoicesResultType | null>(null);
  const [attempt, setAttempt] = useState(0); // Try again asks once more

  useEffect(() => {
    // `live` stops a late answer from updating a page the user already left.
    let live = true;
    fetchCalendarChoices().then((next) => {
      if (live) setResult(next);
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  if (!result) return <p className="mt-6 text-sm text-muted-foreground">Loading your calendars…</p>;
  if (result.state === "nothing") return null;
  if (result.state === "refused") {
    return (
      <div className="mt-6">
        <CentredCardNotice tone="info">{result.message}</CentredCardNotice>
      </div>
    );
  }
  if (result.state === "unreachable") {
    return (
      <div className="mt-6 flex flex-col items-start gap-3">
        <CentredCardNotice>{result.message}</CentredCardNotice>
        <Button
          variant="outline"
          onClick={() => {
            setResult(null);
            setAttempt((count) => count + 1);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }
  return <BusyCalendarsForm choices={result.answer} />;
}

function BusyCalendarsForm({ choices }: { choices: CalendarChoicesType }) {
  const [listed, setListed] = useState(choices);
  const [ticked, setTicked] = useState(() => [
    ...choices.calendars.filter((calendar) => calendar.counts).map((calendar) => calendar.id),
    ...choices.missing,
  ]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string, on: boolean) => {
    setError(null);
    setNotice(null);
    setTicked((ids) => (on ? [...ids, id] : ids.filter((tickedId) => tickedId !== id)));
  };

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const saved = await saveBusyCalendars(ticked);
    setSaving(false);
    if (saved.state === "ok") {
      setListed(saved.answer);
      setTicked([
        ...saved.answer.calendars
          .filter((calendar) => calendar.counts)
          .map((calendar) => calendar.id),
        ...saved.answer.missing,
      ]);
      setNotice({
        tone: "info",
        text: "Saved. Customers are offered times around these calendars.",
      });
      return;
    }
    if (saved.state === "field") setError(saved.message);
    else setNotice({ tone: "error", text: saved.message });
  }

  return (
    <form onSubmit={save} className="mt-6">
      <fieldset aria-describedby={error ? "busy-calendars-error" : "busy-calendars-hint"}>
        <legend className="text-sm font-medium text-foreground">
          Which calendars count as busy
        </legend>
        <p id="busy-calendars-hint" className="mt-1 text-sm text-muted-foreground">
          Customers are never offered a time when anything in a ticked calendar says you are busy.
          Bookings always go into your main calendar.
        </p>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          {listed.calendars.map((calendar, index) => (
            <label key={calendar.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={ticked.includes(calendar.id)}
                onChange={(event) => toggle(calendar.id, event.target.checked)}
                aria-invalid={error && index === 0 ? true : undefined}
                className="size-4 accent-[var(--primary)]"
              />
              <span>
                {calendar.name}
                {calendar.isMain ? <span className="text-muted-foreground"> (main)</span> : null}
              </span>
            </label>
          ))}
          {listed.missing.map((id) => (
            <label key={id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={ticked.includes(id)}
                onChange={(event) => toggle(id, event.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              <span className="text-muted-foreground">
                No longer in your Google account <span className="font-mono text-xs">{id}</span>
              </span>
            </label>
          ))}
        </div>
        {ticked.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--lost)]">
            Nothing ticked: nothing in your Google calendar stops a customer booking you.
          </p>
        ) : null}
        {error ? (
          <p id="busy-calendars-error" role="alert" className="mt-3 text-sm text-[var(--lost)]">
            {error}
          </p>
        ) : null}
      </fieldset>
      <div className="mt-4">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      <SaveNotice notice={notice} />
    </form>
  );
}
