// Booking component: what the window says for each problem. The words Frank agreed at step 9.4's
// plan (2026-10-09).

import type { BookingProblemType } from "../../api-client/problem-from-api-answer.js";

export const problemWords: Record<BookingProblemType, string> = {
  "nothing-to-book": "Nothing can be booked online right now.",
  "cannot-load": "Booking couldn't load right now.",
  "too-many-tries": "Too many tries. Wait a few minutes.",
};
