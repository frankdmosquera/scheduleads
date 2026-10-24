// Frontend: the signed-in person's Google calendars and which count as busy (feature 12h).

import type { InferResponseType } from "hono/client";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import type { RefusalType } from "@/lib/api-client/refusal-type";
import { inDashboardLanguage } from "@/lib/dashboard-words/message-language";

export const calendarChoicesRoute = dashboardApiClient.calendar.calendars;

export type CalendarChoicesType = InferResponseType<typeof calendarChoicesRoute.$get, 200>;

// "nothing": no person or no connection, which the card above already says.
export type CalendarChoicesResultType =
  | { state: "ok"; answer: CalendarChoicesType }
  | { state: "nothing" }
  | { state: "refused"; message: string } // reconnect first
  | { state: "unreachable"; message: string };

export async function fetchCalendarChoices(): Promise<CalendarChoicesResultType> {
  const response = await calendarChoicesRoute.$get().catch(() => null);
  if (!response)
    return { state: "unreachable", message: inDashboardLanguage(apiNotRespondingMessage) };
  if (response.status === 200) return { state: "ok", answer: await response.json() };

  const body = (await response.json().catch(() => ({}))) as RefusalType;
  const message =
    body.error?.message ??
    inDashboardLanguage(`The API answered with an unexpected status (${response.status}).`);
  if (body.error?.code === "no_connection" || body.error?.code === "no_person") {
    return { state: "nothing" };
  }
  if (body.error?.code === "reconnect_needed") return { state: "refused", message };
  return { state: "unreachable", message };
}
