// Frontend: a person or place added or changed from the People page.

import type { InferResponseType } from "hono/client";

import type {
  AddResourceInputType,
  SaveResourceInputType,
} from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { peopleSettingsRoute } from "@/lib/api-client/settings/fetch-people-settings";
import { readSaveRefusal, type SaveResultType } from "@/lib/api-client/settings/read-save-refusal";

export type SavedResourceType = InferResponseType<
  (typeof peopleSettingsRoute)[":resourceId"]["$put"],
  200
>;

// Adding answers the same shape as a change, with nothing to list.
export async function addResource(
  resource: AddResourceInputType
): Promise<SaveResultType<SavedResourceType>> {
  const response = await peopleSettingsRoute.$post({ json: resource }).catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };
  if (response.status === 201) {
    const { resource: added } = await response.json();
    return { state: "ok", answer: { resource: added, upcomingBookings: [] } };
  }
  return readSaveRefusal(response);
}

export async function saveResource(
  resourceId: string,
  resource: SaveResourceInputType
): Promise<SaveResultType<SavedResourceType>> {
  const response = await peopleSettingsRoute[":resourceId"]
    .$put({ param: { resourceId }, json: resource })
    .catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return readSaveRefusal(response);
}
