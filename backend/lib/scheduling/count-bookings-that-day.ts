// Backend: how many bookings each person has on one of the business's own dates, which decides who
// gets an "any available" booking (5c.3). Time off is not a booking, so it never counts. No database.

import { localDate } from "../local-time/local-date.js";
import type { CommitmentType } from "./find-commitments.js";

export function countBookingsThatDay(
  commitments: Pick<CommitmentType, "resourceId" | "kind" | "startsAt">[],
  date: string, // YYYY-MM-DD in the business's zone
  timezone: string
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const commitment of commitments) {
    // A booking belongs to the day it starts on, in the business's zone.
    if (commitment.kind !== "booking" || localDate(commitment.startsAt, timezone) !== date)
      continue;
    counts.set(commitment.resourceId, (counts.get(commitment.resourceId) ?? 0) + 1);
  }
  return counts;
}
