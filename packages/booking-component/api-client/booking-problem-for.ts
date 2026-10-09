// Booking component: which of the window's three problems an answer means. `null` is no answer at
// all: the network, or the 10-second ceiling.

export type BookingProblemType = "nothing-to-book" | "cannot-load" | "too-many-tries";

export function bookingProblemFor(status: number | null): BookingProblemType {
  // The public routes give one "not here" for an unknown business, service or address.
  if (status === 400 || status === 404) return "nothing-to-book";
  if (status === 429) return "too-many-tries";
  return "cannot-load";
}
