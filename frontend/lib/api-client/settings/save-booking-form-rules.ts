// Frontend: what the business's booking form requires, saved from the Booking form page.

import type { InferResponseType } from "hono/client";

import type { BookingFormRulesType } from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { bookingFormRoute } from "@/lib/api-client/settings/fetch-booking-form";
import { readSaveRefusal, type SaveResultType } from "@/lib/api-client/settings/read-save-refusal";
import { inDashboardLanguage } from "@/lib/dashboard-words/message-language";

export type SavedBookingFormRulesType = InferResponseType<typeof bookingFormRoute.rules.$put, 200>;

export async function saveBookingFormRules(
  rules: BookingFormRulesType
): Promise<SaveResultType<SavedBookingFormRulesType>> {
  const response = await bookingFormRoute.rules.$put({ json: rules }).catch(() => null);
  if (!response) return { state: "refused", message: inDashboardLanguage(apiNotRespondingMessage) };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return readSaveRefusal(response);
}
