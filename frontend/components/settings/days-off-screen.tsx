// Frontend component: the Days off page of Settings (feature 12e): every closed day for a year with
// who it is opened for, one form at a time to close a day or open one again, and the bookings a
// close leaves on a closed day, still booked.

"use client";

import { useEffect, useRef, useState } from "react";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { CloseDayForm } from "@/components/settings/close-day-form";
import { ListedBookings, type ListedBookingsType } from "@/components/settings/listed-bookings";
import { OpenDayForm } from "@/components/settings/open-day-form";
import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import {
  fetchDaysOff,
  type ClosedDaySettingsType,
  type DaysOffSettingsType,
} from "@/lib/api-client/settings/fetch-days-off";

export function DaysOffScreen() {
  return (
    <SettingsSection title="Days off" load={fetchDaysOff}>
      {(settings) => <ClosedDaysList settings={settings} />}
    </SettingsSection>
  );
}

const CLOSE_BUTTON_ID = "close-a-day";
const openButtonId = (date: string) => `open-day-${date}`;

// "Monday, November 2, 2026" for a calendar date; noon UTC names the same day everywhere.
const formatDayName = (date: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));

function ClosedDaysList({ settings }: { settings: DaysOffSettingsType }) {
  const [daysOff, setDaysOff] = useState(settings);
  const [open, setOpen] = useState<string | "close" | null>(null); // a day's date, or the close form
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  // Stays until the next save or the page is left, so the owner can call each customer.
  const [listed, setListed] = useState<ListedBookingsType | null>(null);
  // Where the keyboard goes once a form closes: back to the button that opened it, never the top.
  const returnFocus = useRef<string | null>(null);
  useEffect(() => {
    if (open !== null || !returnFocus.current) return;
    document.getElementById(returnFocus.current)?.focus();
    returnFocus.current = null;
  }, [open]);
  const close = (focusId: string) => {
    returnFocus.current = focusId;
    setOpen(null);
  };
  const openForm = (which: string | "close") => {
    setNotice(null);
    setOpen(which);
  };

  const { timezone, canEdit } = daysOff;
  if (!timezone) {
    return (
      <CentredCardNotice tone="info">
        Set the business&apos;s hours on Hours first: a day is closed on the business&apos;s clock.
      </CentredCardNotice>
    );
  }

  const nameOf = (personId: string) =>
    daysOff.people.find((person) => person.id === personId)?.name ?? "";
  const openedLabel = (day: ClosedDaySettingsType) =>
    day.openedForEveryone
      ? "Open for everyone"
      : day.openedFor.length
        ? `Open for ${day.openedFor.map(nameOf).join(", ")}`
        : "Closed";

  return (
    <div className="flex flex-col gap-3">
      {!canEdit ? (
        <CentredCardNotice tone="info">
          Your role cannot change the days off. You can see them here.
        </CentredCardNotice>
      ) : open === "close" ? (
        <CloseDayForm
          daysOff={daysOff}
          timezone={timezone}
          onClosed={(answer, date) => {
            setDaysOff((current) => ({ ...current, ...answer.daysOff }));
            close(CLOSE_BUTTON_ID);
            const count = answer.newlyClosed.length;
            setListed(count ? { bookings: answer.newlyClosed, timezone } : null);
            setNotice({
              tone: "info",
              text: `Closed ${formatDayName(date)}.${
                count
                  ? ` ${count === 1 ? "One booking stays" : `${count} bookings stay`}, listed below.`
                  : ""
              }`,
            });
          }}
          onCancel={() => close(CLOSE_BUTTON_ID)}
        />
      ) : (
        <div>
          <Button id={CLOSE_BUTTON_ID} variant="outline" onClick={() => openForm("close")}>
            + Close a day
          </Button>
        </div>
      )}
      <SaveNotice notice={notice} />
      <ListedBookings list={listed} title="Bookings on the day you closed" Heading="h3" />

      {daysOff.closedDays.length === 0 ? (
        <p className="text-sm text-muted-foreground">No closed days in the coming year.</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {daysOff.closedDays.map((day) =>
          open === day.date ? (
            <li key={day.date}>
              <OpenDayForm
                day={day}
                dayName={formatDayName(day.date)}
                people={daysOff.people}
                onOpened={(answer, forWhom) => {
                  setDaysOff((current) => ({ ...current, ...answer.daysOff }));
                  // Opened for everyone, the day may leave the list: the keyboard goes to Close a day.
                  const stillListed = answer.daysOff.closedDays.some(
                    (listedDay) => listedDay.date === day.date && !listedDay.openedForEveryone
                  );
                  close(stillListed ? openButtonId(day.date) : CLOSE_BUTTON_ID);
                  setListed(null);
                  setNotice({
                    tone: "info",
                    text: `Opened ${formatDayName(day.date)} for ${forWhom}, on their usual hours.`,
                  });
                }}
                onCancel={() => close(openButtonId(day.date))}
              />
            </li>
          ) : (
            <li
              key={day.date}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card px-4 py-3 md:px-6"
            >
              <span className="font-medium text-foreground">{formatDayName(day.date)}</span>
              {day.name ? <span className="text-sm text-muted-foreground">{day.name}</span> : null}
              <span
                className={
                  day.openedForEveryone || day.openedFor.length
                    ? "rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-primary"
                    : "rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                }
              >
                {openedLabel(day)}
              </span>
              {canEdit && !day.openedForEveryone ? (
                <Button
                  id={openButtonId(day.date)}
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  aria-label={`Open ${formatDayName(day.date)} again`}
                  onClick={() => openForm(day.date)}
                >
                  Open again
                </Button>
              ) : null}
            </li>
          )
        )}
      </ul>
    </div>
  );
}
