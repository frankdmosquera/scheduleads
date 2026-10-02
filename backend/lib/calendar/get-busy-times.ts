// Backend: "when is this person busy?" The one call the rest of the app makes; the plug
// behind it is picked by the connection's provider.

import { eq } from "drizzle-orm";

import { calendarConnection } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import type { BusyBlockType, TimeRangeType } from "./calendar-provider.js";
import { getFreshAccessToken } from "./get-fresh-access-token.js";

export async function getBusyTimes({
  organizationId, // from the session or the business being booked, never from the request
  resourceId,
  from,
  to,
}: { organizationId: string; resourceId: string } & TimeRangeType): Promise<BusyBlockType[]> {
  if (!(from < to)) throw new Error("The time range must end after it starts.");

  const access = await getFreshAccessToken({ organizationId, resourceId });
  if (!access) return []; // not connected: no calendar busy times, which is not a failure

  const busy = await access.provider.findBusyBlocks(access.accessToken, { from, to });
  await db
    .update(calendarConnection)
    .set({ lastCheckedAt: new Date() })
    .where(eq(calendarConnection.id, access.connectionId));
  return busy;
}
