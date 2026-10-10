// Frontend: one person's card of hours, saved.

import type { InferResponseType } from "hono/client";

import type { PersonHoursType } from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { hoursSettingsRoute } from "@/lib/api-client/settings/fetch-hours-settings";
import {
  readSaveRefusal,
  type SaveHoursResultType,
} from "@/lib/api-client/settings/read-save-refusal";

const personRoute = hoursSettingsRoute.people[":personId"];

export type SavedPersonHoursType = InferResponseType<typeof personRoute.$put, 200>;

export async function savePersonHours(
  personId: string,
  hours: PersonHoursType
): Promise<SaveHoursResultType<SavedPersonHoursType>> {
  const response = await personRoute.$put({ param: { personId }, json: hours }).catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return readSaveRefusal(response);
}
