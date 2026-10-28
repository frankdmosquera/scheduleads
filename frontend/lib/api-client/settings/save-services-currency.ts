// Frontend: the currency every price is in, saved from the Services page (feature 25d).

import type { SaveCurrencyType } from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { servicesSettingsRoute } from "@/lib/api-client/settings/fetch-services-settings";
import { readSaveRefusal, type SaveResultType } from "@/lib/api-client/settings/read-save-refusal";
import { inDashboardLanguage } from "@/lib/dashboard-words/message-language";

export async function saveServicesCurrency(
  currency: SaveCurrencyType["currency"]
): Promise<SaveResultType<SaveCurrencyType>> {
  const response = await servicesSettingsRoute.currency
    .$put({ json: { currency } })
    .catch(() => null);
  if (!response) return { state: "refused", message: inDashboardLanguage(apiNotRespondingMessage) };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return readSaveRefusal(response);
}
