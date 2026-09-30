// Backend: Disconnect. The permission is handed back first, best effort, then the row is
// deleted whatever the provider said, so no keys are ever kept for a calendar you removed.

import { and, eq } from "drizzle-orm";

import { calendarConnection } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import {
  handBackCalendarPermission,
  type CalendarHandBackResultType,
} from "./hand-back-calendar-permission.js";

// What happened at the provider, so the card can say it in one line.
export type CalendarDisconnectResultType = CalendarHandBackResultType | "already_stopped";

// null when this person has nothing connected.
export async function disconnectCalendar({
  organizationId, // from the session, never from the request
  resourceId, // the signed-in person: only ever your own calendar
}: {
  organizationId: string;
  resourceId: string;
}): Promise<CalendarDisconnectResultType | null> {
  const [connection] = await db
    .select()
    .from(calendarConnection)
    .where(
      and(
        eq(calendarConnection.organizationId, organizationId),
        eq(calendarConnection.resourceId, resourceId)
      )
    )
    .limit(1);
  if (!connection) return null;

  const atProvider = await handBackCalendarPermission({
    provider: connection.provider,
    accountEmail: connection.accountEmail,
    lockedCredentials: connection.credentials,
    resourceId,
  });
  await db.delete(calendarConnection).where(eq(calendarConnection.id, connection.id));

  // The provider had already refused these keys, so there was usually nothing left to hand back.
  if (connection.status === "needs_reconnect" && atProvider === "not_confirmed") {
    return "already_stopped";
  }
  return atProvider;
}
