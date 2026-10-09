// Booking component: when two calls go wrong at once, the problem the customer is told about. A
// limit or a fault can be tried again, so it wins over "nothing to book", which cannot.

import type { BookingProblemType } from "../api-client/booking-problem-for.js";

const worstFirst: BookingProblemType[] = ["too-many-tries", "cannot-load", "nothing-to-book"];

export function worstBookingProblem(
  problems: (BookingProblemType | null)[]
): BookingProblemType | null {
  return worstFirst.find((problem) => problems.includes(problem)) ?? null;
}
