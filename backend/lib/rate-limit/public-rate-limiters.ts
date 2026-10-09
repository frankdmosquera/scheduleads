// Backend: the three limits on the public routes (feature 9, decision 8, agreed by Frank on Oct 8).
// A real customer uses a small part of each; a script from one address, or one contact, does not.

import { createRateLimiter } from "./create-rate-limiter.js";

const MINUTE = 60_000;

export const publicRateLimiters = {
  // Per visitor: every look at services, days and times.
  reads: createRateLimiter({ most: 60, windowMs: MINUTE }),
  // Per visitor: every book, cancel and move.
  writes: createRateLimiter({ most: 10, windowMs: 10 * MINUTE }),
  // Per email, and separately per phone, in one business. A parent booking two or three children
  // at once stays well under it.
  bookingContacts: createRateLimiter({ most: 4, windowMs: 10 * MINUTE }),
};
