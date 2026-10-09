// Frontend: cancelling the customer's own booking through its private link (feature 7a).

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { publicApiClient } from "@/lib/api-client/public-api-client";
import type { BookingPageType } from "@/lib/api-client/customer-booking/fetch-booking-page";

const cancelBookingRoute = publicApiClient.public.bookings[":token"].cancel;

export type CancelBookingPageResultType =
  | { state: "ok"; booking: BookingPageType }
  | { state: "not-found" }
  | { state: "already-started" }
  | { state: "unreachable"; message: string };

// Cancels the customer's own booking through its private link. Safe to repeat: a second press
// answers the same cancelled booking.
export async function cancelBookingPage(token: string): Promise<CancelBookingPageResultType> {
  const response = await cancelBookingRoute.$post({ param: { token } }).catch(() => null);
  if (!response) return { state: "unreachable", message: apiNotRespondingMessage };
  // The route declares only 200, 404 and 409, so the type has no room for the server failing.
  const status: number = response.status;

  if (response.status === 200) {
    const { booking } = await response.json();
    return { state: "ok", booking };
  }
  if (response.status === 404) return { state: "not-found" };
  if (response.status === 409) return { state: "already-started" };

  return {
    state: "unreachable",
    message: `The API answered with an unexpected status (${status}).`,
  };
}
