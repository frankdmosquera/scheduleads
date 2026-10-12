// Backend: cancels one booking, the customer's own act through their private link (feature 7a).
// In one transaction: the booking cancelled, its held time released so the next customer is
// offered it at once, and a booking_cancelled entry on the contact's timeline. Allowed until the
// appointment starts (decision 11). Cancelling twice is one cancel (decision 4). Saved with it, as
// jobs: taking the event out of the booked person's Google and telling both sides, so the answer
// waits for neither. The owner's screens call it too, in the owner's form (feature 12e).

import { db } from "../../database.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";
import {
  cancelBookingInTransaction,
  type CancelBookingResultType,
  type OwnerCancelType,
} from "./cancel-booking-in-transaction.js";

export type { CancelBookingResultType, OwnerCancelType };

// The customer's form: the booking id comes from a verified link (decision 10), and its business
// from the row.
export async function cancelBooking(
  bookingId: string,
  now: Date,
  byOwner: OwnerCancelType | null = null
): Promise<CancelBookingResultType> {
  let result: CancelBookingResultType;
  try {
    result = await db.transaction((tx) => cancelBookingInTransaction(tx, bookingId, now, byOwner));
  } catch (error) {
    // Never the database's own error: its message carries the query.
    throw new Error(`Cancelling a booking failed: ${safeErrorReason(error)}`);
  }
  return result;
}
