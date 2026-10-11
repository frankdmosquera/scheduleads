// Frontend: the Services page of Settings, read.

import type { InferResponseType } from "hono/client";

import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import {
  readSettingsResponse,
  type SettingsReadResultType,
} from "@/lib/api-client/settings/read-settings-response";

export const servicesSettingsRoute = dashboardApiClient.settings.services;

// Every service of the business, live or hidden, and whether this login may change them.
export type ServicesSettingsType = InferResponseType<typeof servicesSettingsRoute.$get, 200>;
export type ServiceSettingsType = ServicesSettingsType["services"][number];

export async function fetchServicesSettings(): Promise<
  SettingsReadResultType<ServicesSettingsType>
> {
  const response = await servicesSettingsRoute.$get().catch(() => null);
  return readSettingsResponse(response, "This business cannot change its services here.");
}
