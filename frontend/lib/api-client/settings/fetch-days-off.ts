// Frontend: the Days off page of Settings, read.

import type { InferResponseType } from "hono/client";

import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import {
  readSettingsResponse,
  type SettingsReadResultType,
} from "@/lib/api-client/settings/read-settings-response";

export const daysOffRoute = dashboardApiClient.settings["days-off"];

// The closed days and holiday picks, every closed day for a year with who it is opened for, the
// active people, and whether this login may change them.
export type DaysOffSettingsType = InferResponseType<typeof daysOffRoute.$get, 200>;
export type ClosedDaySettingsType = DaysOffSettingsType["closedDays"][number];

export async function fetchDaysOff(): Promise<SettingsReadResultType<DaysOffSettingsType>> {
  const response = await daysOffRoute.$get().catch(() => null);
  return readSettingsResponse(response, "This business cannot change its days off here.");
}
