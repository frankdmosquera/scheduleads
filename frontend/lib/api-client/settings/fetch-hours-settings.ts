// Frontend: the Hours section of Settings, read.

import type { InferResponseType } from "hono/client";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import type { RefusalType } from "@/lib/api-client/refusal-type";

export const hoursSettingsRoute = dashboardApiClient.settings.hours;

// The business's hours (null before the first save), every active person's, and whether this
// login may change them.
export type HoursSettingsType = InferResponseType<typeof hoursSettingsRoute.$get, 200>;

export type HoursSettingsResultType =
  | { state: "ok"; answer: HoursSettingsType }
  | { state: "signed-out" }
  | { state: "refused"; message: string }
  | { state: "unreachable"; message: string };

export async function fetchHoursSettings(): Promise<HoursSettingsResultType> {
  const response = await hoursSettingsRoute.$get().catch(() => null);
  if (!response) return { state: "unreachable", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  // From the middleware, which the route's type does not list: an ended sign-in, or a refusal.
  const status: number = response.status;
  if (status === 401) return { state: "signed-out" };
  if (status === 403) {
    const body = (await response.json().catch(() => ({}))) as RefusalType;
    return {
      state: "refused",
      message: body.error?.message ?? "This business cannot change its hours here.",
    };
  }
  return {
    state: "unreachable",
    message: `The API answered with an unexpected status (${status}).`,
  };
}
