// Frontend: the People page of Settings, read.

import type { InferResponseType } from "hono/client";

import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import {
  readSettingsResponse,
  type SettingsReadResultType,
} from "@/lib/api-client/settings/read-settings-response";

export const peopleSettingsRoute = dashboardApiClient.settings.people;

// Every person, on or off, with what each can do and their hours, the business's time zone and week,
// and whether this login may change them.
export type PeopleSettingsType = InferResponseType<typeof peopleSettingsRoute.$get, 200>;
export type ResourceSettingsType = PeopleSettingsType["people"][number];

export async function fetchPeopleSettings(): Promise<SettingsReadResultType<PeopleSettingsType>> {
  const response = await peopleSettingsRoute.$get().catch(() => null);
  return readSettingsResponse(response, "This business cannot change its people here.");
}
