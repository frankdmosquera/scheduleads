// Frontend: moving the customer's own booking to another time (feature 7b), through its private link.

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { publicApiClient } from "@/lib/api-client/public-api-client";
import type { RefusalType } from "@/lib/api-client/refusal-type";
import type { BookingPageType } from "@/lib/api-client/customer-booking/fetch-booking-page";
import { moveRefusalState } from "@/lib/api-client/customer-booking/move-refusal-state";

const moveBookingRoute = publicApiClient.public.bookings[":token"].move;

export type MoveBookingPageResultType =
  | { state: "ok"; booking: BookingPageType }
  | { state: "not-found" }
  | { state: "time-taken" }
  | { state: "already-started" }
  | { state: "already-cancelled" }
  | { state: "unreachable"; message: string };

// Moves the customer's own booking to one of the times offered, through its private link. Safe to
// repeat: a second press to the same time answers the booking as it is.
export async function moveBookingPage(
  token: string,
  move: { startsAt: string; personId: string | null }
): Promise<MoveBookingPageResultType> {
  const response = await moveBookingRoute.$post({ param: { token }, json: move }).catch(() => null);
  if (!response) return { state: "unreachable", message: apiNotRespondingMessage };
  const status: number = response.status;

  if (response.status === 200) {
    const { booking } = await response.json();
    return { state: "ok", booking };
  }
  if (response.status === 404) return { state: "not-found" };
  if (response.status === 409) {
    const refusal: RefusalType = await response.json();
    if (refusal.error?.code === "time_taken") return { state: "time-taken" };
    return moveRefusalState(refusal);
  }

  return {
    state: "unreachable",
    message: `The API answered with an unexpected status (${status}).`,
  };
}
