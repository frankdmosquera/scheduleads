// Frontend: the business's three colours, saved from the Look page (feature 25e).

import type { BusinessColoursType } from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { lookSettingsRoute } from "@/lib/api-client/settings/fetch-look-settings";
import { readSaveRefusal, type SaveResultType } from "@/lib/api-client/settings/read-save-refusal";
import { inDashboardLanguage } from "@/lib/dashboard-words/message-language";

export async function saveBusinessColours(
  colours: BusinessColoursType
): Promise<SaveResultType<BusinessColoursType>> {
  const response = await lookSettingsRoute.colours.$put({ json: colours }).catch(() => null);
  if (!response) return { state: "refused", message: inDashboardLanguage(apiNotRespondingMessage) };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return readSaveRefusal(response);
}
