// Frontend: what one person can do, saved from their card on the People page (feature 12k).

import type { InferResponseType } from "hono/client";

import type { SavePersonSkillsInputType } from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { peopleSettingsRoute } from "@/lib/api-client/settings/fetch-people-settings";
import { readSaveRefusal, type SaveResultType } from "@/lib/api-client/settings/read-save-refusal";
import { inDashboardLanguage } from "@/lib/dashboard-words/message-language";

export type SavedPersonSkillsType = InferResponseType<
  (typeof peopleSettingsRoute)[":resourceId"]["skills"]["$put"],
  200
>;

export async function savePersonSkills(
  personId: string,
  body: SavePersonSkillsInputType
): Promise<SaveResultType<SavedPersonSkillsType>> {
  const response = await peopleSettingsRoute[":resourceId"].skills
    .$put({ param: { resourceId: personId }, json: body })
    .catch(() => null);
  if (!response) return { state: "refused", message: inDashboardLanguage(apiNotRespondingMessage) };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return readSaveRefusal(response);
}
