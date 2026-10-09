// Booking component: one service, with its layout and who picks the person. A service the business
// does not offer (unknown, inactive or another business's) is "nothing to book".

import type { BookingApiClientType, BookingServiceDetailsType } from "./booking-api-types.js";
import { problemFromApiAnswer, type BookingProblemType } from "./problem-from-api-answer.js";

export type OneServiceResultType =
  | { state: "ok"; service: BookingServiceDetailsType }
  | { state: "problem"; problem: BookingProblemType };

export async function fetchOneService(
  apiClient: BookingApiClientType,
  slug: string,
  bookingLinkId: string
): Promise<OneServiceResultType> {
  try {
    const response = await apiClient.public[":slug"]["booking-links"][":bookingLinkId"].$get({
      param: { slug, bookingLinkId },
    });
    const status: number = response.status; // the rate limit's 429 is not in the route's type
    if (response.status !== 200) return { state: "problem", problem: problemFromApiAnswer(status) };

    const { bookingLink } = await response.json();
    return { state: "ok", service: bookingLink };
  } catch {
    return { state: "problem", problem: problemFromApiAnswer(null) };
  }
}
