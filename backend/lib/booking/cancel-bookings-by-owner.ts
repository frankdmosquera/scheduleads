// Backend: the owner cancels one booking or several from the dashboard (feature 12e). Each is the
// customer's own cancel done for them, in the owner's form: see cancel-booking.ts.

import { and, eq, inArray } from "drizzle-orm";

import { booking } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { cancelBooking } from "./cancel-booking.js";

export type CancelBookingsByOwnerResultType =
  | {
      ok: true;
      cancelled: string[];
      alreadyCancelled: string[];
      alreadyStarted: string[]; // not cancelled: the appointment has begun
    }
  | { ok: false }; // a booking that is not this business's: nothing was cancelled

export async function cancelBookingsByOwner(
  organizationId: string,
  actorUserId: string,
  bookingIds: string[],
  now: Date
): Promise<CancelBookingsByOwnerResultType> {
  // All of them must be the business's before any is cancelled: one stranger's id refuses the lot.
  const found = await db
    .select({ id: booking.id })
    .from(booking)
    .where(and(eq(booking.organizationId, organizationId), inArray(booking.id, bookingIds)));
  if (found.length !== bookingIds.length) return { ok: false };

  // One at a time, each in its own transaction, as the customer's cancel is: one that fails
  // midway leaves the others as they were, and a press again finishes the rest.
  const [cancelled, alreadyCancelled, alreadyStarted]: string[][] = [[], [], []];
  for (const bookingId of bookingIds) {
    const result = await cancelBooking(bookingId, now, { organizationId, actorUserId });
    if (result.cancelled) {
      (result.alreadyCancelled ? alreadyCancelled : cancelled).push(bookingId);
    } else if (result.reason === "already_started") {
      alreadyStarted.push(bookingId);
    } else {
      throw new Error(`Booking ${bookingId} of this business was not found while cancelling.`);
    }
  }
  return { ok: true, cancelled, alreadyCancelled, alreadyStarted };
}
