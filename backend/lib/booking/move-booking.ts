// Backend: moves one booking to another time, the customer's own act through their private link
// (feature 7b). Changing the time is booking again (decision 10): the new start must be one of the
// free times for this booking, any available or the person picked, with its own old time never in
// the way (prepareBookingMove). Then one transaction, the booking row locked: the old held time
// released, the new held, the booking's times, person, room and invite number saved, and a
// booking_moved entry, or nothing changes (applyBookingMove). Until the appointment starts
// (decision 12). The same start again is one move (decision 4). Saved with it, as jobs: the booked
// person's Google event following it and both sides told, so the answer waits for neither.

import { db } from "../../database.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";
import { applyBookingMove } from "./apply-booking-move.js";
import { EveryChoiceTakenError } from "./every-choice-taken-error.js";
import { prepareBookingMove } from "./prepare-booking-move.js";

export type MoveBookingResultType =
  | { moved: true; unchanged: boolean } // unchanged: it was already there (decision 4)
  | {
      moved: false;
      reason:
        | "not_found"
        | "already_cancelled"
        | "already_started"
        | "time_taken"
        | "unavailable"
        | "person_not_taken";
    };

// The booking id comes from a verified link (decision 10); its business comes from the row.
export async function moveBooking(input: {
  bookingId: string;
  startsAt: Date; // the new start, one of the free times offered
  personId: string | null; // null = any available
  now: Date;
}): Promise<MoveBookingResultType> {
  const prepared = await prepareBookingMove(input);
  if (!prepared.ready) {
    if (prepared.unchanged) return { moved: true, unchanged: true };
    // Only the owner's move is refused as in the past: a customer's start is one of the free times.
    if (prepared.reason === "in_the_past") {
      throw new Error("Moving failed: a customer's move was refused as in the past.");
    }
    return { moved: false, reason: prepared.reason };
  }

  try {
    return await db.transaction((tx) => applyBookingMove(tx, prepared.plan));
  } catch (error) {
    if (error instanceof EveryChoiceTakenError) return { moved: false, reason: "time_taken" };
    // Never the database's own error: its message carries the query.
    throw new Error(`Moving a booking failed: ${safeErrorReason(error)}`);
  }
}
