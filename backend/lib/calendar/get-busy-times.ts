// Backend: "when is this person busy?" The one call the rest of the app makes; the plug
// behind it is picked by the connection's provider, and it reads the calendars the person ticked.

import { and, eq } from "drizzle-orm";

import { calendarConnection } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { crossOffSpan } from "../scheduling/cross-off-span.js";
import type { BusyBlockType, TimeRangeType } from "./calendar-provider.js";
import { getFreshAccessToken } from "./get-fresh-access-token.js";

export async function getBusyTimes({
  organizationId, // from the session or the business being booked, never from the request
  resourceId,
  from,
  to,
  crossOffOnMain,
}: { organizationId: string; resourceId: string } & TimeRangeType & {
    // The app's own bookings: their spans are taken out of the main calendar, which holds their
    // events (feature 7b, decision 11), and never out of another calendar (feature 12h). A moved
    // booking's own old time; the calendar's bookings, shown apart (feature 12b).
    crossOffOnMain?: BusyBlockType[];
  }): Promise<BusyBlockType[]> {
  if (!(from < to)) throw new Error("The time range must end after it starts.");

  // Nothing ticked is the person's own choice: Google is not asked, not even for a fresh key, so a
  // lapsed connection never blocks someone whose calendars do not count.
  const [pick] = await db
    .select({ busyCalendarIds: calendarConnection.busyCalendarIds })
    .from(calendarConnection)
    .where(
      and(
        eq(calendarConnection.organizationId, organizationId),
        eq(calendarConnection.resourceId, resourceId)
      )
    )
    .limit(1);
  if (!pick || pick.busyCalendarIds.length === 0) return []; // not connected, or nothing ticked

  const access = await getFreshAccessToken({ organizationId, resourceId });
  if (!access || access.busyCalendarIds.length === 0) return []; // disconnected or unticked meanwhile

  const calendars = await access.provider.findBusyBlocks(
    access.accessToken,
    { from, to },
    access.busyCalendarIds
  );
  await db
    .update(calendarConnection)
    .set({ lastCheckedAt: new Date() })
    .where(eq(calendarConnection.id, access.connectionId));
  return calendars.flatMap(({ calendarId, busy }) =>
    calendarId === "primary"
      ? (crossOffOnMain ?? []).reduce((left, span) => crossOffSpan(left, span), busy)
      : busy
  );
}
