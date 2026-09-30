// Backend: hands a person's calendar permission back to the provider, best effort. The
// provider keeps one permission per account for our app, so while another connection
// still uses the same account it is kept: handing it back would cut that one off too.

import { and, eq, ne, sql } from "drizzle-orm";

import { calendarConnection } from "@scheduleads-app/shared/db";
import { decryptCredentials, readTokenKey } from "@scheduleads-app/shared/crypto";

import { db } from "../../database.js";
import { findCalendarProvider } from "./find-calendar-provider.js";
import type { CalendarCredentialsType } from "./save-calendar-connection.js";

export type CalendarHandBackResultType =
  | "handed_back" // the provider confirmed
  | "not_confirmed" // the provider did not answer, or our copy of the keys could not be opened
  | "still_used"; // another connection uses the same account, so the permission stays

export async function handBackCalendarPermission({
  provider,
  accountEmail,
  lockedCredentials,
  resourceId, // the person the keys are sealed to; their own row is not "another connection"
}: {
  provider: string;
  accountEmail: string;
  lockedCredentials: string;
  resourceId: string;
}): Promise<CalendarHandBackResultType> {
  // Across every business: the same Gmail can be one person in two businesses.
  const [otherUse] = await db
    .select({ id: calendarConnection.id })
    .from(calendarConnection)
    .where(
      and(
        eq(calendarConnection.provider, provider),
        sql`lower(${calendarConnection.accountEmail}) = lower(${accountEmail})`,
        ne(calendarConnection.resourceId, resourceId)
      )
    )
    .limit(1);
  if (otherUse) return "still_used";

  let credentials: CalendarCredentialsType;
  try {
    credentials = JSON.parse(decryptCredentials(lockedCredentials, readTokenKey(), resourceId));
  } catch {
    return "not_confirmed"; // keys we cannot open cannot be handed back
  }

  const confirmed = await findCalendarProvider(provider).revoke(credentials.refreshToken);
  return confirmed ? "handed_back" : "not_confirmed";
}
