// Backend: the Google plug for the seam. Busy times come from Google's free/busy, a booking goes
// into the main calendar as an event; refreshing and handing back reuse the sign-in conversation
// in google-oauth-client.ts.

import type {
  BusyBlockType,
  CalendarEventType,
  CalendarProviderType,
  TimeRangeType,
} from "./calendar-provider.js";
import { googleOauthClient } from "./google-oauth-client.js";

const FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const TIMEOUT_MS = 10_000; // a Google that hangs throws, it never answers "free"

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

  async findBusyBlocks(accessToken: string, { from, to }: TimeRangeType) {
    const response = await fetch(FREEBUSY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        items: [{ id: "primary" }], // the main calendar only; the owner's picker is feature 12
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Google's free/busy failed (${response.status}).`);

    const body = (await response.json()) as {
      calendars?: Record<string, GoogleFreeBusyCalendarType>;
    };
    // One calendar was asked for, so exactly one must come back, whatever key Google files it under.
    const calendars = Object.values(body.calendars ?? {});
    if (calendars.length !== 1) throw new Error("Google's free/busy answer had no calendar.");

    // A calendar Google could not read comes back with errors and no busy times: not "free".
    const [calendar] = calendars;
    if (calendar.errors?.length) {
      const reason = calendar.errors[0].reason;
      const why = typeof reason === "string" && /^[a-zA-Z]+$/.test(reason) ? reason : "error";
      throw new Error(`Google could not read the calendar's busy times (${why}).`);
    }
    return (calendar.busy ?? []).map(toBusyBlock);
  },

  async createEvent(accessToken: string, event: CalendarEventType) {
    const response = await fetch(EVENTS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      // No attendees, so Google sends nobody an invitation.
      body: JSON.stringify({
        summary: event.title,
        location: event.location,
        description: event.description,
        start: { dateTime: event.start.toISOString(), timeZone: event.timezone },
        end: { dateTime: event.end.toISOString(), timeZone: event.timezone },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Google refused the event (${response.status}).`);

    const body = (await response.json()) as { id?: unknown };
    if (typeof body.id !== "string" || body.id === "") {
      throw new Error("Google's answer to the event had no id.");
    }
    return body.id;
  },

  revoke: (token) => googleOauthClient.revoke(token),
};
