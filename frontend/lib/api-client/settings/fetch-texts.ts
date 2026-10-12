// Frontend: the Texts page of Settings, read.

import type { InferResponseType } from "hono/client";

import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import {
  readSettingsResponse,
  type SettingsReadResultType,
} from "@/lib/api-client/settings/read-settings-response";

export const textsRoute = dashboardApiClient.settings.texts;

// The business's texting number and text choices (null before the agency sets texts up), and
// whether this login may change them.
export type TextsSettingsType = InferResponseType<typeof textsRoute.$get, 200>;

export async function fetchTexts(): Promise<SettingsReadResultType<TextsSettingsType>> {
  const response = await textsRoute.$get().catch(() => null);
  return readSettingsResponse(response, "This business cannot change its texts here.");
}
