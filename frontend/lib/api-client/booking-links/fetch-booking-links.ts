// Frontend: a business's active booking links (its services), from the public route.

import type { InferResponseType } from "hono/client";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { publicApiClient } from "@/lib/api-client/public-api-client";

const bookingLinksRoute = publicApiClient.public[":slug"]["booking-links"];

export type BookingLinkType = InferResponseType<
  typeof bookingLinksRoute.$get,
  200
>["bookingLinks"][number];

export type BookingLinksResultType =
  | { state: "ok"; bookingLinks: BookingLinkType[] }
  | { state: "not-bookable" }
  | { state: "unreachable"; message: string };

// A business's active booking links, from the public route a client site will call too.
export async function fetchBookingLinks(slug: string): Promise<BookingLinksResultType> {
  const response = await bookingLinksRoute.$get({ param: { slug } }).catch(() => null);
  if (!response) return { state: "unreachable", message: apiNotRespondingMessage };

  if (response.status === 200) {
    const { bookingLinks } = await response.json();
    return { state: "ok", bookingLinks };
  }

  // The slug came from /me, so the business exists: a 404 means not open for online
  // booking yet (no hours, or no booking in its plan). Not an error; retrying cannot help.
  if (response.status === 404) return { state: "not-bookable" };

  return {
    state: "unreachable",
    message: `The API answered with an unexpected status (${response.status}).`,
  };
}
