// Frontend: the business's card of hours, saved.

import type { InferResponseType } from "hono/client";

import type { BusinessHoursType } from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { hoursSettingsRoute } from "@/lib/api-client/settings/fetch-hours-settings";
import { readSaveRefusal, type SaveResultType } from "@/lib/api-client/settings/read-save-refusal";

export type SavedBusinessHoursType = InferResponseType<
  typeof hoursSettingsRoute.business.$put,
  200
>;

export async function saveBusinessHours(
  hours: BusinessHoursType
): Promise<SaveResultType<SavedBusinessHoursType>> {
  const response = await hoursSettingsRoute.business.$put({ json: hours }).catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return readSaveRefusal(response);
}
