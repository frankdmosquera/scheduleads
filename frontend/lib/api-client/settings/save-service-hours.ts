// Frontend: when one service runs, saved from the Services page (feature 12k).

import type { InferResponseType } from "hono/client";

import type { PersonHoursType } from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { servicesSettingsRoute } from "@/lib/api-client/settings/fetch-services-settings";
import { readSaveRefusal, type SaveResultType } from "@/lib/api-client/settings/read-save-refusal";
import { inDashboardLanguage } from "@/lib/dashboard-words/message-language";

const hoursRoute = servicesSettingsRoute[":serviceId"].hours;

export type SavedServiceHoursType = InferResponseType<typeof hoursRoute.$put, 200>;

export async function saveServiceHours(
  serviceId: string,
  hours: PersonHoursType
): Promise<SaveResultType<SavedServiceHoursType>> {
  const response = await hoursRoute.$put({ param: { serviceId }, json: hours }).catch(() => null);
  if (!response) return { state: "refused", message: inDashboardLanguage(apiNotRespondingMessage) };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return readSaveRefusal(response);
}
