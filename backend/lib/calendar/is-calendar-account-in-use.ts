// Backend: whether a calendar account is connected anywhere, across every business. The
// provider keeps one permission per account for our app, so handing it back while it is
// in use cancels that connection too.

import { and, eq, ne, sql } from "drizzle-orm";

import { calendarConnection } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export async function isCalendarAccountInUse({
  provider,
  accountEmail,
  exceptResourceId, // a person whose own row is the one going away (Disconnect, a switched account)
}: {
  provider: string;
  accountEmail: string;
  exceptResourceId?: string;
}): Promise<boolean> {
  const [inUse] = await db
    .select({ id: calendarConnection.id })
    .from(calendarConnection)
    .where(
      and(
        eq(calendarConnection.provider, provider),
        sql`lower(${calendarConnection.accountEmail}) = lower(${accountEmail})`,
        exceptResourceId ? ne(calendarConnection.resourceId, exceptResourceId) : undefined
      )
    )
    .limit(1);
  return Boolean(inUse);
}
