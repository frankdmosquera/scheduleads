// Booking component: one service, with its layout, who picks the person and its bookable hours. A service the business
// does not offer (unknown, inactive or another business's) is "nothing to book".

import type {
  BookingApiClientType,
  BookingAvailabilityType,
  BookingServiceDetailsType,
} from "./booking-api-types.js";
import { problemFromApiAnswer, type BookingProblemType } from "./problem-from-api-answer.js";

export type OneServiceResultType =
  | { state: "ok"; service: BookingServiceDetailsType; availability: BookingAvailabilityType }
  | { state: "problem"; problem: BookingProblemType };

export async function fetchOneService(
  apiClient: BookingApiClientType,
  slug: string,
  bookingLinkId: string
): Promise<OneServiceResultType> {
  // Hono's client drops an empty segment, so a blank id would ask for the whole list (F-278).
  if (slug.trim() === "" || bookingLinkId.trim() === "") {
    return { state: "problem", problem: "nothing-to-book" };
  }

  try {
    // Hono's client puts the values in the path as they are: a "/" or "?" would reach another route.
    const response = await apiClient.public[":slug"]["booking-links"][":bookingLinkId"].$get({
      param: { slug: encodeURIComponent(slug), bookingLinkId: encodeURIComponent(bookingLinkId) },
    });
    const status: number = response.status; // the rate limit's 429 is not in the route's type
    if (response.status !== 200) return { state: "problem", problem: problemFromApiAnswer(status) };

    const { bookingLink, availability } = await response.json();
    // Never trusted blindly: an answer with no service in it would crash the host's page.
    if (!bookingLink || !availability)
      return { state: "problem", problem: problemFromApiAnswer(null) };
    return { state: "ok", service: bookingLink, availability };
  } catch {
    return { state: "problem", problem: problemFromApiAnswer(null) };
  }
}
