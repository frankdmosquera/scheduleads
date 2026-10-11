// Frontend: the business's own questions saved from the Booking form page, the whole list in order.

import type { InferResponseType } from "hono/client";

import type { BookingQuestionsInputType } from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { bookingFormRoute } from "@/lib/api-client/settings/fetch-booking-form";
import { readSaveRefusal, type SaveResultType } from "@/lib/api-client/settings/read-save-refusal";

export type SavedBookingQuestionsType = InferResponseType<
  typeof bookingFormRoute.questions.$put,
  200
>;

export async function saveBookingQuestions(
  questions: BookingQuestionsInputType
): Promise<SaveResultType<SavedBookingQuestionsType>> {
  const response = await bookingFormRoute.questions.$put({ json: questions }).catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return readSaveRefusal(response);
}
