// Frontend component: marking a person or a place off on the Calendar page (feature 12b), from one
// day and time to another. When bookings are in the way, they come back listed, and the owner
// chooses for each: cancel it, or move it. One save does all of it or none.

"use client";

import { useState } from "react";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveTimeOff, type BookingInTheWayType } from "@/lib/api-client/schedule/save-time-off";

type ChoiceType =
  { action: "cancel" } | { action: "move"; date: string; time: string; personId: string };

// "10:00" from a time box; null when empty.
const minuteOf = (time: string): number | null => {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return Number.isNaN(hours) ? null : hours * 60 + minutes;
};

// The span's own fields, each shown under its box.
const shownFields = ["from.date", "from.minute", "to.date", "to.minute", "to"];

// "Fri, Nov 20, 10:00 a.m." in the business's zone.
const momentWords = (iso: string, timezone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));

export function TimeOffForm({
  resourceId,
  firstDate,
  timezone,
  onSaved,
}: {
  resourceId: string;
  firstDate: string; // the week shown, so the form starts there
  timezone: string;
  onSaved: () => void; // the week reads again, showing the time off
}) {
  const [fromDate, setFromDate] = useState(firstDate);
  const [fromTime, setFromTime] = useState("");
  const [toDate, setToDate] = useState(firstDate);
  const [toTime, setToTime] = useState("");
  const [inTheWay, setInTheWay] = useState<BookingInTheWayType[]>([]);
  const [choices, setChoices] = useState<Record<string, ChoiceType>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  const [saving, setSaving] = useState(false);

  const edited = () => {
    setErrors({});
    setNotice(null);
  };
  // A new span means new bookings in the way: the old list and choices go.
  const spanEdited = () => {
    edited();
    setInTheWay([]);
    setChoices({});
  };
  const choose = (bookingId: string, choice: ChoiceType) => {
    edited();
    setChoices((all) => ({ ...all, [bookingId]: choice }));
  };

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const bookings = [];
    for (const one of inTheWay) {
      if (one.started) continue; // offered no choice: its own notice says to start after it
      const choice = choices[one.id];
      if (!choice) {
        setErrors({ [`booking-${one.id}`]: "Choose move or cancel." });
        return;
      }
      if (choice.action === "cancel") {
        bookings.push({ bookingId: one.id, action: "cancel" as const });
        continue;
      }
      const startMinute = minuteOf(choice.time);
      if (startMinute === null) {
        setErrors({ [`booking-${one.id}`]: "Pick the new time." });
        return;
      }
      bookings.push({
        bookingId: one.id,
        action: "move" as const,
        date: choice.date,
        startMinute,
        personId: choice.personId,
      });
    }

    setSaving(true);
    const saved = await saveTimeOff({
      resourceId,
      // A blank time is the whole day: from its start, to its end.
      from: { date: fromDate, minute: minuteOf(fromTime) ?? 0 },
      to: { date: toDate, minute: minuteOf(toTime) ?? 1440 },
      bookings,
    });
    setSaving(false);
    if (saved.state === "ok") {
      setInTheWay([]);
      setChoices({});
      setNotice({
        tone: "info",
        text: bookings.length
          ? "Saved. The time off is in, and each customer hears what happened to their booking."
          : "Saved. The time off is in.",
      });
      onSaved();
      return;
    }
    if (saved.state === "in_the_way") {
      setInTheWay(saved.bookings);
      setNotice({ tone: "error", text: saved.message });
      return;
    }
    if (saved.state === "field") {
      // "bookings.2.date" is the third booking sent, shown under that booking; a field the form
      // has no place for goes in the notice.
      const sent = /^bookings\.(\d+)\./.exec(saved.field);
      const bookingId = sent ? bookings[Number(sent[1])]?.bookingId : undefined;
      if (bookingId) setErrors({ [`booking-${bookingId}`]: saved.message });
      else if (shownFields.includes(saved.field)) setErrors({ [saved.field]: saved.message });
      else setNotice({ tone: "error", text: saved.message });
      return;
    }
    if (saved.bookingId) setErrors({ [`booking-${saved.bookingId}`]: saved.message });
    else setNotice({ tone: "error", text: saved.message });
  }

  const fieldError = (field: string) =>
    errors[field] ? (
      <p role="alert" className="mt-1 text-xs text-[var(--lost)]">
        {errors[field]}
      </p>
    ) : null;

  return (
    <form onSubmit={save} className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Time off</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        An afternoon, a day or a week. Leave a time blank for the whole day. Bookings in that time
        are listed here, to move or cancel in the same save.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">
            <span className="text-muted-foreground">From</span>
            <Input
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value);
                spanEdited();
              }}
              className="mt-1"
            />
            {fieldError("from.date")}
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">at</span>
            <Input
              type="time"
              value={fromTime}
              onChange={(event) => {
                setFromTime(event.target.value);
                spanEdited();
              }}
              className="mt-1"
            />
            {fieldError("from.minute")}
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">
            <span className="text-muted-foreground">To</span>
            <Input
              type="date"
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value);
                spanEdited();
              }}
              className="mt-1"
            />
            {fieldError("to.date") ?? fieldError("to")}
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">at</span>
            <Input
              type="time"
              value={toTime}
              onChange={(event) => {
                setToTime(event.target.value);
                spanEdited();
              }}
              className="mt-1"
            />
            {fieldError("to.minute")}
          </label>
        </div>
      </div>

      {inTheWay.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">Bookings in that time</h3>
          {inTheWay.map((one) => {
            const choice = choices[one.id];
            return (
              <fieldset key={one.id} className="rounded-md border border-border p-3 text-sm">
                <legend className="px-1 font-medium text-foreground">
                  {one.customerName} &middot; {one.serviceName} &middot;{" "}
                  {momentWords(one.startsAt, timezone)}
                </legend>
                {one.started ? (
                  <CentredCardNotice>
                    Already begun: it can be neither moved nor cancelled. Start the time off after
                    it.
                  </CentredCardNotice>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`choice-${one.id}`}
                          checked={choice?.action === "move"}
                          onChange={() =>
                            choose(one.id, {
                              action: "move",
                              date: toDate,
                              time: "",
                              personId: one.personId,
                            })
                          }
                        />
                        Move it
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`choice-${one.id}`}
                          checked={choice?.action === "cancel"}
                          onChange={() => choose(one.id, { action: "cancel" })}
                        />
                        Cancel it
                      </label>
                    </div>
                    {choice?.action === "move" ? (
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <Input
                          type="date"
                          aria-label="New day"
                          value={choice.date}
                          onChange={(event) =>
                            choose(one.id, { ...choice, date: event.target.value })
                          }
                        />
                        <Input
                          type="time"
                          aria-label="New time"
                          value={choice.time}
                          onChange={(event) =>
                            choose(one.id, { ...choice, time: event.target.value })
                          }
                        />
                        <select
                          aria-label="Who does it"
                          value={choice.personId}
                          onChange={(event) =>
                            choose(one.id, { ...choice, personId: event.target.value })
                          }
                          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        >
                          {one.people.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </>
                )}
                {fieldError(`booking-${one.id}`)}
              </fieldset>
            );
          })}
        </div>
      ) : null}

      <div className="mt-4">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save time off"}
        </Button>
      </div>
      <SaveNotice notice={notice} />
    </form>
  );
}
