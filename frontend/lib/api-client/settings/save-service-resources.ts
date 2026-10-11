// Frontend: who does a service, ticked on the Services page; the ticks replace the ones before.

import type { InferResponseType } from "hono/client";

import type { SaveServiceResourcesInputType } from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { servicesSettingsRoute } from "@/lib/api-client/settings/fetch-services-settings";
import { readSaveRefusal, type SaveResultType } from "@/lib/api-client/settings/read-save-refusal";

export type SavedServiceResourcesType = InferResponseType<
  (typeof servicesSettingsRoute)[":serviceId"]["resources"]["$put"],
  200
>;

export async function saveServiceResources(
  serviceId: string,
  ticks: SaveServiceResourcesInputType
): Promise<SaveResultType<SavedServiceResourcesType>> {
  const response = await servicesSettingsRoute[":serviceId"].resources
    .$put({ param: { serviceId }, json: ticks })
    .catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return readSaveRefusal(response);
}
