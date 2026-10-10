// Frontend: a service added or changed from the Services page.

import type { InferResponseType } from "hono/client";

import type { ServiceInputType } from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { servicesSettingsRoute } from "@/lib/api-client/settings/fetch-services-settings";
import { readSaveRefusal, type SaveResultType } from "@/lib/api-client/settings/read-save-refusal";

export type SavedServiceType = InferResponseType<
  (typeof servicesSettingsRoute)[":serviceId"]["$put"],
  200
>;

// serviceId null adds a new one; the answer has the same shape either way (no list when added).
export async function saveService(
  serviceId: string | null,
  service: ServiceInputType
): Promise<SaveResultType<SavedServiceType>> {
  const response = await (
    serviceId
      ? servicesSettingsRoute[":serviceId"].$put({ param: { serviceId }, json: service })
      : servicesSettingsRoute.$post({ json: service })
  ).catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  if (response.status === 201) {
    const { service: added } = await response.json();
    return { state: "ok", answer: { service: added, outsideHours: [] } };
  }
  return readSaveRefusal(response);
}
