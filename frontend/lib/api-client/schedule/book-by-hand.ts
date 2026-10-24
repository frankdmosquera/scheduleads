// Frontend: a booking the owner makes by hand on the Calendar page (feature 12b).

import type { InferResponseType } from "hono/client";

import type { BookByHandInputType } from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import { readSaveRefusal, type SaveResultType } from "@/lib/api-client/settings/read-save-refusal";
import { inDashboardLanguage } from "@/lib/dashboard-words/message-language";

const bookingsRoute = dashboardApiClient.schedule.bookings;

export type BookedByHandType = InferResponseType<typeof bookingsRoute.$post, 201>;

export async function bookByHand(
  booking: BookByHandInputType
): Promise<SaveResultType<BookedByHandType>> {
  const response = await bookingsRoute.$post({ json: booking }).catch(() => null);
  if (!response) return { state: "refused", message: inDashboardLanguage(apiNotRespondingMessage) };
  if (response.status === 201) return { state: "ok", answer: await response.json() };
  return readSaveRefusal(response);
}
