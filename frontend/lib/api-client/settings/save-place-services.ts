// Frontend: the services that need one place, saved from its card on the Places page (feature 12k).

import type { InferResponseType } from "hono/client";

import type { SavePlaceServicesInputType } from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { placesSettingsRoute } from "@/lib/api-client/settings/fetch-places-settings";
import { readSaveRefusal, type SaveResultType } from "@/lib/api-client/settings/read-save-refusal";
import { inDashboardLanguage } from "@/lib/dashboard-words/message-language";

export type SavedPlaceServicesType = InferResponseType<
  (typeof placesSettingsRoute)[":resourceId"]["services"]["$put"],
  200
>;

export async function savePlaceServices(
  placeId: string,
  body: SavePlaceServicesInputType
): Promise<SaveResultType<SavedPlaceServicesType>> {
  const response = await placesSettingsRoute[":resourceId"].services
    .$put({ param: { resourceId: placeId }, json: body })
    .catch(() => null);
  if (!response) return { state: "refused", message: inDashboardLanguage(apiNotRespondingMessage) };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return readSaveRefusal(response);
}
