// Booking component: the business's face, its questions and its active services, for the list.

import type {
  BookingApiClientType,
  BookingBusinessType,
  BookingServiceType,
} from "./booking-api-types.js";
import { problemFromApiAnswer, type BookingProblemType } from "./problem-from-api-answer.js";

export type ServiceListResultType =
  | { state: "ok"; business: BookingBusinessType; services: BookingServiceType[] }
  | { state: "problem"; problem: BookingProblemType };

export async function fetchServiceList(
  apiClient: BookingApiClientType,
  slug: string
): Promise<ServiceListResultType> {
  try {
    const response = await apiClient.public[":slug"]["booking-links"].$get({ param: { slug } });
    // The rate limit's 429 comes from middleware, so the route's own type has no room for it.
    const status: number = response.status;
    if (response.status !== 200) return { state: "problem", problem: problemFromApiAnswer(status) };

    const { business, bookingLinks } = await response.json();
    return { state: "ok", business, services: bookingLinks };
  } catch {
    // Only the network or the time limit throws here: fetch rejects, or the body never finishes.
    return { state: "problem", problem: problemFromApiAnswer(null) };
  }
}
