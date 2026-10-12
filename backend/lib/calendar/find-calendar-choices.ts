// Backend: the person's own calendars as their provider lists them now, and which they ticked
// (feature 12h). Read live every time, so a calendar added at Google shows without a reconnect.

import type { CalendarListEntryType } from "./calendar-provider.js";
import { CalendarReconnectNeededError } from "./calendar-reconnect-needed-error.js";
import { getFreshAccessToken } from "./get-fresh-access-token.js";
import { googleOauthClient } from "./google-oauth-client.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";

export type CalendarChoicesFoundType =
  | {
      ok: true;
      connectionId: string;
      accountEmail: string;
      listed: CalendarListEntryType[];
      picked: string[];
    }
  | {
      ok: false;
      // reconnect_needed: Google stopped accepting it, so no calendar is read at all;
      // no_list_permission: connected before 12h, still reading the main calendar.
      reason: "no_connection" | "reconnect_needed" | "no_list_permission" | "unavailable";
    };

export async function findCalendarChoices({
  organizationId, // from the session, never from the request
  resourceId, // the signed-in person: only ever your own calendars
}: {
  organizationId: string;
  resourceId: string;
}): Promise<CalendarChoicesFoundType> {
  try {
    const access = await getFreshAccessToken({ organizationId, resourceId });
    if (!access) return { ok: false, reason: "no_connection" };
    // Google is the only provider; a connection made before 12h was never allowed the list.
    if (!googleOauthClient.canListCalendars(access.grantedScopes)) {
      return { ok: false, reason: "no_list_permission" };
    }

    const listed = await access.provider.listCalendars(access.accessToken);
    return {
      ok: true,
      connectionId: access.connectionId,
      accountEmail: access.accountEmail,
      listed,
      picked: access.busyCalendarIds,
    };
  } catch (error) {
    if (error instanceof CalendarReconnectNeededError)
      return { ok: false, reason: "reconnect_needed" };
    console.warn(`[calendar] the calendar list could not be read: ${safeErrorReason(error)}`);
    return { ok: false, reason: "unavailable" };
  }
}
