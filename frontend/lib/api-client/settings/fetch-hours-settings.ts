// Frontend: the Hours page of Settings, read.

import type { InferResponseType } from "hono/client";

import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import {
  readSettingsResponse,
  type SettingsReadResultType,
} from "@/lib/api-client/settings/read-settings-response";

export const hoursSettingsRoute = dashboardApiClient.settings.hours;

// The business's hours (null before the first save), every active person's, and whether this
// login may change them.
export type HoursSettingsType = InferResponseType<typeof hoursSettingsRoute.$get, 200>;

export type HoursSettingsResultType = SettingsReadResultType<HoursSettingsType>;

export async function fetchHoursSettings(): Promise<HoursSettingsResultType> {
  const response = await hoursSettingsRoute.$get().catch(() => null);
  return readSettingsResponse(response, "This business cannot change its hours here.");
}
