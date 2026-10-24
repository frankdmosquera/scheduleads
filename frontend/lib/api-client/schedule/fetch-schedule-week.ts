// Frontend: one person's or place's week for the Calendar page (feature 12b).

import type { InferResponseType } from "hono/client";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import type { RefusalType } from "@/lib/api-client/refusal-type";
import { inDashboardLanguage } from "@/lib/dashboard-words/message-language";

const scheduleRoute = dashboardApiClient.schedule;

export type ScheduleWeekType = InferResponseType<typeof scheduleRoute.$get, 200>;
export type ScheduleDayType = ScheduleWeekType["days"][number];
export type ScheduleItemType = ScheduleDayType["items"][number];

export type ScheduleWeekResultType =
  | { state: "ok"; week: ScheduleWeekType }
  | { state: "signed-out" }
  | { state: "refused"; message: string }
  | { state: "unreachable"; message: string };

// Nothing asked: the caller's own person, this week.
export async function fetchScheduleWeek(asked: {
  resourceId?: string;
  weekOf?: string;
  withoutGoogle?: boolean; // the Month view: no Google busy times asked for
}): Promise<ScheduleWeekResultType> {
  const query = {
    ...(asked.resourceId ? { resourceId: asked.resourceId } : {}),
    ...(asked.weekOf ? { weekOf: asked.weekOf } : {}),
    ...(asked.withoutGoogle ? { google: "skip" as const } : {}),
  };
  const response = await scheduleRoute.$get({ query }).catch(() => null);
  if (!response)
    return { state: "unreachable", message: inDashboardLanguage(apiNotRespondingMessage) };
  if (response.status === 200) return { state: "ok", week: await response.json() };
  // From the middleware or the route: an ended sign-in, or a refusal in plain words.
  const status: number = response.status;
  if (status === 401) return { state: "signed-out" };
  const body = (await response.json().catch(() => ({}))) as RefusalType;
  if (status === 400 || status === 403 || status === 404 || status === 409) {
    return {
      state: "refused",
      message: body.error?.message ?? inDashboardLanguage("This calendar cannot be shown."),
    };
  }
  return {
    state: "unreachable",
    message: inDashboardLanguage(`The API answered with an unexpected status (${status}).`),
  };
}
