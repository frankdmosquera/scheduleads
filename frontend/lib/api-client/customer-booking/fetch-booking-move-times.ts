// Frontend: the times a customer's booking could move to (feature 7b), through its private link.

import type { InferResponseType } from "hono/client";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { publicApiClient } from "@/lib/api-client/public-api-client";
import { moveRefusalState } from "@/lib/api-client/customer-booking/move-refusal-state";

const bookingMoveTimesRoute = publicApiClient.public.bookings[":token"].times;

export type BookingMoveTimesType = InferResponseType<typeof bookingMoveTimesRoute.$get, 200>;

export type BookingMoveTimesResultType =
  | { state: "ok"; times: BookingMoveTimesType }
  | { state: "not-found" }
  | { state: "already-started" }
  | { state: "already-cancelled" }
  | { state: "unreachable"; message: string }; // the API or a calendar cannot be read right now

// The times the customer's booking could move to, for one week of the business's dates, any
// available when no person is given (feature 7b). The public client: never the login cookie.
export async function fetchBookingMoveTimes(
  token: string,
  week: { from: string; to: string; personId: string | null }
): Promise<BookingMoveTimesResultType> {
  const query = {
    from: week.from,
    to: week.to,
    ...(week.personId ? { person: week.personId } : {}),
  };
  const response = await bookingMoveTimesRoute.$get({ param: { token }, query }).catch(() => null);
  if (!response) return { state: "unreachable", message: apiNotRespondingMessage };
  const status: number = response.status;

  if (response.status === 200) return { state: "ok", times: await response.json() };
  if (response.status === 404) return { state: "not-found" };
  if (response.status === 409) return moveRefusalState(await response.json());

  return {
    state: "unreachable",
    message: `The API answered with an unexpected status (${status}).`,
  };
}
