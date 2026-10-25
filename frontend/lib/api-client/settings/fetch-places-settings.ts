// Frontend: the Places page of Settings, read (feature 12k).

import type { InferResponseType } from "hono/client";

import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import {
  readSettingsResponse,
  type SettingsReadResultType,
} from "@/lib/api-client/settings/read-settings-response";

export const placesSettingsRoute = dashboardApiClient.settings.places;

// Every place, on or off, the services that need each, and whether this login may change them.
export type PlacesSettingsType = InferResponseType<typeof placesSettingsRoute.$get, 200>;

export async function fetchPlacesSettings(): Promise<SettingsReadResultType<PlacesSettingsType>> {
  const response = await placesSettingsRoute.$get().catch(() => null);
  return readSettingsResponse(response, "This business cannot change its places here.");
}
