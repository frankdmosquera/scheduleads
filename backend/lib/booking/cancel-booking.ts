// Backend: cancels one booking, the customer's own act through their private link (feature 7a).
// In one transaction: the booking cancelled, its held time released so the next customer is
// offered it at once, and a booking_cancelled entry on the contact's timeline. Allowed until the
// appointment starts (decision 11). Cancelling twice is one cancel (decision 4). Once saved, the
// booked person's Google event starts going, without the answer waiting for it. The owner's
// screens (features 11 and 12b) call it too.

import { and, eq } from "drizzle-orm";

import { booking, commitment, lead } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { recordActivity } from "../crm/record-activity.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";
import { releaseTime } from "../scheduling/release-time.js";
import { bookingEventRemovals } from "./booking-event-removals.js";

export type CancelBookingResultType =
  | { cancelled: true; alreadyCancelled: boolean }
  | { cancelled: false; reason: "not_found" | "already_started" };

// The booking id comes from a verified link (decision 10); its business comes from the row.
export async function cancelBooking(
  bookingId: string,
  now: Date
): Promise<CancelBookingResultType> {
  // The business, once this call cancelled the booking. Typed by a cast, not by the declaration,
  // so TypeScript does not narrow it to null and stop checking its use after the transaction.
  let cancelledIn = null as string | null;
  let result: CancelBookingResultType;
  try {
    result = await db.transaction(async (tx) => {
      // Locked first, so two presses at the same instant make one cancel, never two.
      const [row] = await tx
        .select({
          organizationId: booking.organizationId,
          status: booking.status,
          startsAt: booking.startsAt,
          contactId: lead.contactId,
        })
        .from(booking)
        .innerJoin(
          lead,
          and(eq(lead.organizationId, booking.organizationId), eq(lead.id, booking.leadId))
        )
        .where(eq(booking.id, bookingId))
        .for("update", { of: booking })
        .limit(1);
      if (!row) return { cancelled: false, reason: "not_found" } as const;
      if (row.status === "cancelled") return { cancelled: true, alreadyCancelled: true } as const;
      if (row.startsAt.getTime() <= now.getTime()) {
        return { cancelled: false, reason: "already_started" } as const;
      }
      const { organizationId } = row;

      // Only a confirmed booking changes: should two cancels ever pass the lock together, the
      // second finds nothing to change and answers as already cancelled.
      const changed = await tx
        .update(booking)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(booking.organizationId, organizationId),
            eq(booking.id, bookingId),
            eq(booking.status, "confirmed")
          )
        )
        .returning({ id: booking.id });
      if (changed.length === 0) return { cancelled: true, alreadyCancelled: true } as const;

      const held = await tx
        .select({ id: commitment.id })
        .from(commitment)
        .where(
          and(
            eq(commitment.organizationId, organizationId),
            eq(commitment.bookingId, bookingId),
            eq(commitment.status, "active")
          )
        );
      await releaseTime(
        organizationId,
        held.map((rowHeld) => rowHeld.id),
        tx
      );
      // actorUserId stays null: the customer did it, not a login.
      await recordActivity(
        organizationId,
        { contactId: row.contactId, type: "booking_cancelled", payload: { bookingId } },
        tx
      );
      cancelledIn = organizationId;
      return { cancelled: true, alreadyCancelled: false } as const;
    });
  } catch (error) {
    // Never the database's own error: its message carries the query.
    throw new Error(`Cancelling a booking failed: ${safeErrorReason(error)}`);
  }
  // Saved. Only a cancel that changed something removes the event, so a second press never does.
  if (cancelledIn) bookingEventRemovals.start(cancelledIn, bookingId);
  return result;
}
