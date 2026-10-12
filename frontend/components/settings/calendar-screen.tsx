// Frontend component: the Calendar page of Settings (feature 12h): your own Google calendar, and
// which of your calendars count as busy. Every member sets their own.

"use client";

import { useState } from "react";

import { CalendarConnectionCard } from "@/components/calendar/calendar-connection-card";
import { BusyCalendarsPart } from "@/components/settings/busy-calendars-part";

export function CalendarScreen() {
  // A disconnect reads the calendar list again, so it never offers ticks for a calendar now gone.
  const [connectionVersion, setConnectionVersion] = useState(0);

  return (
    <CalendarConnectionCard onChanged={() => setConnectionVersion((version) => version + 1)}>
      <BusyCalendarsPart key={connectionVersion} />
    </CalendarConnectionCard>
  );
}
