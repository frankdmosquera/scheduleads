// Frontend: the Hours section of Settings, read.

import type { InferResponseType } from "hono/client";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";

export const hoursSettingsRoute = dashboardApiClient.settings.hours;

// The business's hours (null before the first save), every active person's, and whether this
// login may change them.
export type HoursSettingsType = InferResponseType<typeof hoursSettingsRoute.$get, 200>;

export type HoursSettingsResultType =
  { state: "ok"; answer: HoursSettingsType } | { state: "unreachable"; message: string };

export async function fetchHoursSettings(): Promise<HoursSettingsResultType> {
  const response = await hoursSettingsRoute.$get().catch(() => null);
  if (!response) return { state: "unreachable", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return {
    state: "unreachable",
    message: `The API answered with an unexpected status (${response.status}).`,
  };
}
