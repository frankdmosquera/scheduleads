// Booking component: the problem screen's state. Try again only where trying again can help:
// "nothing to book" stays so whatever is pressed.

import type { BookingBusinessType } from "../api-client/booking-api-types.js";
import type { BookingProblemType } from "../api-client/problem-from-api-answer.js";
import type { BookingScreenType } from "./booking-screen-type.js";

export function bookingProblemScreen(
  problem: BookingProblemType,
  business: BookingBusinessType | null,
  retry: () => void
): BookingScreenType {
  return {
    screen: "problem",
    problem,
    business,
    retry: problem === "nothing-to-book" ? null : retry,
  };
}
