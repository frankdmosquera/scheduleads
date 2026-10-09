// Frontend: the customer's own booking page, read through its private link.

import type { InferResponseType } from "hono/client";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { publicApiClient } from "@/lib/api-client/public-api-client";

const bookingPageRoute = publicApiClient.public.bookings[":token"];

export type BookingPageType = InferResponseType<typeof bookingPageRoute.$get, 200>["booking"];

export type BookingPageResultType =
  | { state: "ok"; booking: BookingPageType }
  | { state: "not-found" }
  | { state: "unreachable"; message: string };

// The customer's own booking, opened by the private link in their email. The public client: the
// login cookie never goes with it.
export async function fetchBookingPage(token: string): Promise<BookingPageResultType> {
  const response = await bookingPageRoute.$get({ param: { token } }).catch(() => null);
  if (!response) return { state: "unreachable", message: apiNotRespondingMessage };
  // The route declares only 200 and 404, so the type has no room for the server failing.
  const status: number = response.status;

  if (response.status === 200) {
    const { booking } = await response.json();
    return { state: "ok", booking };
  }
  if (response.status === 404) return { state: "not-found" };

  return {
    state: "unreachable",
    message: `The API answered with an unexpected status (${status}).`,
  };
}
