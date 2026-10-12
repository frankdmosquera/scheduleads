// Backend: the Google plug for the seam. Busy times come from Google's free/busy for the person's
// picked calendars, which come from their calendar list; a booking goes into the main calendar as
// an event; refreshing and handing back reuse the sign-in conversation in google-oauth-client.ts.

import type {
  BusyBlockType,
  CalendarEventType,
  CalendarListEntryType,
  CalendarProviderType,
  TimeRangeType,
} from "./calendar-provider.js";
import { googleOauthClient } from "./google-oauth-client.js";

const FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy";
const CALENDAR_LIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const TIMEOUT_MS = 10_000; // a Google that hangs throws, it never answers "free"

type GoogleCalendarListItemType = {
  id?: unknown;
  summary?: unknown;
  summaryOverride?: unknown; // the name the person gave a calendar shared with them
  primary?: unknown;
};

type GoogleFreeBusyCalendarType = {
  busy?: { start?: unknown; end?: unknown }[];
  errors?: { reason?: unknown }[];
};

function toBusyBlock(busy: { start?: unknown; end?: unknown }): BusyBlockType {
  const start = new Date(String(busy.start));
  const end = new Date(String(busy.end));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Google's free/busy answer had a busy time that is not a date.");
  }
  return { start, end };
}

export const googleCalendarProvider: CalendarProviderType = {
  refreshAccessToken: (refreshToken) => googleOauthClient.refreshAccessToken(refreshToken),

  async findBusyBlocks(accessToken: string, { from, to }: TimeRangeType, calendarIds: string[]) {
    const response = await fetch(FREEBUSY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        items: calendarIds.map((id) => ({ id })), // the person's pick (feature 12h)
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Google's free/busy failed (${response.status}).`);

    const body = (await response.json()) as {
      calendars?: Record<string, GoogleFreeBusyCalendarType>;
    };
    // Every calendar asked for must come back, whatever key Google files "primary" under.
    const calendars = Object.values(body.calendars ?? {});
    if (calendars.length !== calendarIds.length) {
      throw new Error("Google's free/busy answer did not have every calendar asked for.");
    }

    // A calendar Google could not read comes back with errors and no busy times: not "free".
    for (const calendar of calendars) {
      if (calendar.errors?.length) {
        const reason = calendar.errors[0].reason;
        const why = typeof reason === "string" && /^[a-zA-Z]+$/.test(reason) ? reason : "error";
        throw new Error(`Google could not read a calendar's busy times (${why}).`);
      }
    }
    return calendars.flatMap((calendar) => (calendar.busy ?? []).map(toBusyBlock));
  },

  async listCalendars(accessToken: string) {
    const entries: CalendarListEntryType[] = [];
    let pageToken: string | null = null;
    // A page holds up to 250; ten pages is past anyone's list, and stops a loop that never ends.
    for (let page = 0; page < 10; page++) {
      const url = new URL(CALENDAR_LIST_URL);
      url.searchParams.set("minAccessRole", "freeBusyReader"); // the ones whose busy times can be read
      url.searchParams.set("maxResults", "250");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Google's calendar list failed (${response.status}).`);

      const body = (await response.json()) as {
        items?: GoogleCalendarListItemType[];
        nextPageToken?: unknown;
      };
      for (const item of body.items ?? []) {
        if (typeof item.id !== "string" || item.id === "") continue;
        const isMain = item.primary === true;
        const name = [item.summaryOverride, item.summary].find(
          (value): value is string => typeof value === "string" && value.trim() !== ""
        );
        entries.push({ id: isMain ? "primary" : item.id, name: name ?? item.id, isMain });
      }
      if (typeof body.nextPageToken !== "string") break;
      pageToken = body.nextPageToken;
    }
    // The main one first, the rest in the person's own order at Google.
    return [
      ...entries.filter((entry) => entry.isMain),
      ...entries.filter((entry) => !entry.isMain),
    ];
  },

  async createEvent(accessToken: string, event: CalendarEventType) {
    const response = await fetch(EVENTS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      // No attendees, so Google sends nobody an invitation.
      body: JSON.stringify({
        id: event.id,
        summary: event.title,
        location: event.location ?? undefined, // left out when the booking has none
        description: event.description,
        start: { dateTime: event.start.toISOString(), timeZone: event.timezone },
        end: { dateTime: event.end.toISOString(), timeZone: event.timezone },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // 409: an event with this id exists, written by an earlier try whose answer was lost.
    if (response.status === 409) return event.id;
    if (!response.ok) throw new Error(`Google refused the event (${response.status}).`);

    const body = (await response.json()) as { id?: unknown };
    if (typeof body.id !== "string" || body.id === "") {
      throw new Error("Google's answer to the event had no id.");
    }
    return body.id;
  },

  async deleteEvent(accessToken: string, eventId: string) {
    const response = await fetch(`${EVENTS_URL}/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // 404 never written or already deleted, 410 deleted earlier: the event is gone either way.
    if (response.ok || response.status === 404 || response.status === 410) return;
    throw new Error(`Google refused to remove the event (${response.status}).`);
  },

  async updateEventTime(accessToken: string, eventId: string, { start, end, timezone }) {
    const response = await fetch(`${EVENTS_URL}/${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        start: { dateTime: start.toISOString(), timeZone: timezone },
        end: { dateTime: end.toISOString(), timeZone: timezone },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // 404 never written, 410 deleted: there is no event to move.
    if (response.status === 404 || response.status === 410) return false;
    if (!response.ok) throw new Error(`Google refused to move the event (${response.status}).`);
    return true;
  },

  revoke: (token) => googleOauthClient.revoke(token),
};
