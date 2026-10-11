// Frontend: the owner cancelling bookings, one or a list, each as its customer would.

import type { InferResponseType } from "hono/client";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import { readSaveRefusal, type SaveResultType } from "@/lib/api-client/settings/read-save-refusal";

const cancelBookingsRoute = dashboardApiClient.bookings.cancel;

// Which were cancelled now, which already were, and which had started and were left as they are.
export type CancelledBookingsType = InferResponseType<typeof cancelBookingsRoute.$post, 200>;

export async function cancelBookings(
  bookingIds: string[]
): Promise<SaveResultType<CancelledBookingsType>> {
  const response = await cancelBookingsRoute.$post({ json: { bookingIds } }).catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return readSaveRefusal(response);
}
