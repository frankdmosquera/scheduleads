// Backend: saving which of the person's calendars count as busy (feature 12h). Only a calendar on
// their list right now, or one already ticked (so a calendar that left can stay until unticked).

import { and, eq } from "drizzle-orm";

import { calendarConnection } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { findCalendarChoices, type CalendarChoicesFoundType } from "./find-calendar-choices.js";
import { toCalendarChoices, type CalendarChoicesType } from "./to-calendar-choices.js";

export type BusyCalendarsSavedType =
  | { ok: true; choices: CalendarChoicesType }
  | Extract<CalendarChoicesFoundType, { ok: false }>
  | { ok: false; reason: "unknown_calendar" };

export async function saveBusyCalendars({
  organizationId, // from the session, never from the request
  resourceId, // the signed-in person: only ever your own calendars
  calendarIds,
}: {
  organizationId: string;
  resourceId: string;
  calendarIds: string[];
}): Promise<BusyCalendarsSavedType> {
  const found = await findCalendarChoices({ organizationId, resourceId });
  if (!found.ok) return found;

  const allowed = new Set([...found.listed.map((calendar) => calendar.id), ...found.picked]);
  if (calendarIds.some((id) => !allowed.has(id))) return { ok: false, reason: "unknown_calendar" };

  // Only the row as read: a reconnect with another account meanwhile is never given this pick.
  const saved = await db
    .update(calendarConnection)
    .set({ busyCalendarIds: calendarIds })
    .where(
      and(
        eq(calendarConnection.id, found.connectionId),
        eq(calendarConnection.organizationId, organizationId),
        eq(calendarConnection.resourceId, resourceId),
        eq(calendarConnection.accountEmail, found.accountEmail)
      )
    )
    .returning({ id: calendarConnection.id });
  if (saved.length === 0) return { ok: false, reason: "unavailable" };

  return { ok: true, choices: toCalendarChoices(found.listed, calendarIds) };
}
