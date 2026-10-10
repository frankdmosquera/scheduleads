// Booking component: what the window says for each problem.

import type { BookingProblemType } from "../../api-client/problem-from-api-answer.js";

export const problemWords: Record<BookingProblemType, string> = {
  "nothing-to-book": "Nothing can be booked online right now.",
  "cannot-load": "Booking couldn't load right now.",
  "too-many-tries": "Too many tries. Wait a few minutes.",
};
