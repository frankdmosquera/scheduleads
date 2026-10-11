// Frontend: the Days off page's closed days saved, a day closed, and a closed day opened again.

import type { InferResponseType } from "hono/client";

import type {
  CloseDayType,
  DaysOffType,
  OpenClosedDayType,
} from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { daysOffRoute } from "@/lib/api-client/settings/fetch-days-off";
import { readSaveRefusal, type SaveResultType } from "@/lib/api-client/settings/read-save-refusal";

// The days off as saved, and the upcoming bookings now on a closed day, still booked.
export type SavedDaysOffType = InferResponseType<typeof daysOffRoute.$put, 200>;
// Closing one day answers the same shape as the save.
export type ClosedDayAnswerType = InferResponseType<typeof daysOffRoute.close.$post, 200>;
export type OpenedClosedDayType = InferResponseType<typeof daysOffRoute.open.$post, 200>;

export async function saveDaysOff(daysOff: DaysOffType): Promise<SaveResultType<SavedDaysOffType>> {
  const response = await daysOffRoute.$put({ json: daysOff }).catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return readSaveRefusal(response);
}

export async function closeDay(day: CloseDayType): Promise<SaveResultType<ClosedDayAnswerType>> {
  const response = await daysOffRoute.close.$post({ json: day }).catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return readSaveRefusal(response);
}

export async function openClosedDay(
  opening: OpenClosedDayType
): Promise<SaveResultType<OpenedClosedDayType>> {
  const response = await daysOffRoute.open.$post({ json: opening }).catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return readSaveRefusal(response);
}
