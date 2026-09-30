// Backend: "when is this person busy?" The one call the rest of the app makes; the plug
// behind it is picked by the connection's provider.

import { and, eq } from "drizzle-orm";

import { calendarConnection } from "@scheduleads-app/shared/db";
import {
  decryptCredentials,
  encryptCredentials,
  readTokenKey,
} from "@scheduleads-app/shared/crypto";

import { db } from "../../database.js";
import type { BusyBlockType, CalendarProviderType, TimeRangeType } from "./calendar-provider.js";
import { CalendarReconnectNeededError } from "./calendar-reconnect-needed-error.js";
import { googleCalendarProvider } from "./google-calendar-provider.js";
import type { CalendarCredentialsType } from "./save-calendar-connection.js";

const PROVIDERS: Record<string, CalendarProviderType> = { google: googleCalendarProvider };
const REFRESH_MARGIN_MS = 60_000; // a key with under a minute left could expire mid-question
const ATTEMPTS = 2; // one more read when a reconnect or another refresh changed the row meanwhile

export async function getBusyTimes({
  organizationId, // from the session or the business being booked, never from the request
  resourceId,
  from,
  to,
}: { organizationId: string; resourceId: string } & TimeRangeType): Promise<BusyBlockType[]> {
  if (!(from < to)) throw new Error("The time range must end after it starts.");

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
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
    if (!connection) return []; // not connected: no calendar busy times, which is not a failure
    if (connection.status === "needs_reconnect") throw new CalendarReconnectNeededError();

    const provider = PROVIDERS[connection.provider];
    if (!provider) throw new Error(`No calendar plug for "${connection.provider}".`);

    const key = readTokenKey();
    const credentials = JSON.parse(
      decryptCredentials(connection.credentials, key, resourceId)
    ) as CalendarCredentialsType;
    let accessToken = credentials.accessToken;

    // Writes touch only the row exactly as read, so a reconnect at the same moment is never
    // overwritten with the old account's keys.
    const unchangedRow = and(
      eq(calendarConnection.id, connection.id),
      eq(calendarConnection.credentials, connection.credentials)
    );

    const expiresAt = new Date(credentials.accessTokenExpiresAt).getTime();
    // Written as "not comfortably valid", so an unreadable date refreshes too.
    if (!(expiresAt - Date.now() > REFRESH_MARGIN_MS)) {
      let fresh;
      try {
        fresh = await provider.refreshAccessToken(credentials.refreshToken);
      } catch (error) {
        if (!(error instanceof CalendarReconnectNeededError)) throw error;
        const marked = await db
          .update(calendarConnection)
          .set({ status: "needs_reconnect" })
          .where(unchangedRow)
          .returning({ id: calendarConnection.id });
        if (marked.length === 0) continue; // reconnected meanwhile: the new keys may work
        throw error;
      }

      const renewed: CalendarCredentialsType = {
        refreshToken: fresh.refreshToken ?? credentials.refreshToken,
        accessToken: fresh.accessToken,
        accessTokenExpiresAt: fresh.accessTokenExpiresAt.toISOString(),
      };
      const saved = await db
        .update(calendarConnection)
        .set({ credentials: encryptCredentials(JSON.stringify(renewed), key, resourceId) })
        .where(unchangedRow)
        .returning({ id: calendarConnection.id });
      if (saved.length === 0) continue; // changed meanwhile: read it again rather than overwrite it
      accessToken = renewed.accessToken;
    }

    const busy = await provider.findBusyBlocks(accessToken, { from, to });
    await db
      .update(calendarConnection)
      .set({ lastCheckedAt: new Date() })
      .where(eq(calendarConnection.id, connection.id));
    return busy;
  }

  throw new Error("The calendar connection kept changing while it was being read.");
}
