// Frontend: the Days off page's holiday picker, read: the countries offered, and for a country its
// provinces and its holidays for the coming year.

import type { InferResponseType } from "hono/client";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { daysOffRoute } from "@/lib/api-client/settings/fetch-days-off";
import { readSaveRefusal, type SaveResultType } from "@/lib/api-client/settings/read-save-refusal";
import { dashboardLanguage, inDashboardLanguage } from "@/lib/dashboard-words/message-language";

export type HolidayChoicesType = InferResponseType<typeof daysOffRoute.holidays.$get, 200>;
export type HolidayChoiceType = HolidayChoicesType["holidays"][number];

export async function fetchHolidayChoices(
  country: string | null,
  region: string | null
): Promise<SaveResultType<HolidayChoicesType>> {
  const query = { country: country ?? "", region: region ?? "", language: dashboardLanguage() }; // empty: not picked
  const response = await daysOffRoute.holidays.$get({ query }).catch(() => null);
  if (!response) return { state: "refused", message: inDashboardLanguage(apiNotRespondingMessage) };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return readSaveRefusal(response);
}
