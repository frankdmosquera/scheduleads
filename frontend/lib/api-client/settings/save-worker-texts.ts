// Frontend: one person's worker texts saved from the People page: on with a phone, or off (null).

import type { InferResponseType } from "hono/client";

import type { SaveWorkerTextsInputType } from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { peopleSettingsRoute } from "@/lib/api-client/settings/fetch-people-settings";
import { readSaveRefusal, type SaveResultType } from "@/lib/api-client/settings/read-save-refusal";

export type SavedWorkerTextsType = InferResponseType<
  (typeof peopleSettingsRoute)[":resourceId"]["texts"]["$put"],
  200
>;

export async function saveWorkerTexts(
  personId: string,
  body: SaveWorkerTextsInputType
): Promise<SaveResultType<SavedWorkerTextsType>> {
  const response = await peopleSettingsRoute[":resourceId"].texts
    .$put({ param: { resourceId: personId }, json: body })
    .catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return readSaveRefusal(response);
}
