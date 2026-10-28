// Frontend: the Look page of Settings, read (feature 25e).

import type { InferResponseType } from "hono/client";

import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import {
  readSettingsResponse,
  type SettingsReadResultType,
} from "@/lib/api-client/settings/read-settings-response";

export const lookSettingsRoute = dashboardApiClient.settings.look;

// The business's name and logo, and whether this login may change them.
export type LookSettingsType = InferResponseType<typeof lookSettingsRoute.$get, 200>;

export async function fetchLookSettings(): Promise<SettingsReadResultType<LookSettingsType>> {
  const response = await lookSettingsRoute.$get().catch(() => null);
  return readSettingsResponse(response, "This business cannot change its look here.");
}
