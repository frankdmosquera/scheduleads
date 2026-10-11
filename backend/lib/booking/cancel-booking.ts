// Backend: cancels one booking, the customer's own act through their private link (feature 7a).
// In one transaction: the booking cancelled, its held time released so the next customer is
// offered it at once, and a booking_cancelled entry on the contact's timeline. Allowed until the
// appointment starts (decision 11). Cancelling twice is one cancel (decision 4). Saved with it, as
// jobs: taking the event out of the booked person's Google and telling both sides, so the answer
// waits for neither. The owner's screens call it too, in the owner's form (feature 12e).

import { and, eq } from "drizzle-orm";

import { booking, commitment, lead } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { calendarEventIdOf } from "../calendar/calendar-event-id-of.js";
import { recordActivity } from "../crm/record-activity.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";
import { enqueueBookingEmails } from "../jobs/enqueue-booking-emails.js";
import { enqueueBookingEventJob } from "../jobs/enqueue-booking-event-job.js";
import { enqueueWorkerText } from "../jobs/enqueue-worker-text.js";
import { jobNames } from "../jobs/job-names.js";
import { releaseTime } from "../scheduling/release-time.js";

export type CancelBookingResultType =
  | { cancelled: true; alreadyCancelled: boolean }
  | { cancelled: false; reason: "not_found" | "already_started" };

// The owner cancelling from the dashboard: the booking is looked for inside the session's business,
// the timeline names the login, and the business is not told what its own owner did.
export type OwnerCancelType = { organizationId: string; actorUserId: string };

// The customer's form: the booking id comes from a verified link (decision 10), and its business
// from the row.
export async function cancelBooking(
  bookingId: string,
  now: Date,
  byOwner: OwnerCancelType | null = null
): Promise<CancelBookingResultType> {
  let result: CancelBookingResultType;
  try {
    result = await db.transaction(async (tx) => {
      // Locked first, so two presses at the same instant make one cancel, never two.
      const [row] = await tx
        .select({
          organizationId: booking.organizationId,
          status: booking.status,
          startsAt: booking.startsAt,
          personId: booking.personId,
          sequence: booking.sequence,
          calendarEventId: booking.calendarEventId,
          contactId: lead.contactId,
        })
        .from(booking)
        .innerJoin(
          lead,
          and(eq(lead.organizationId, booking.organizationId), eq(lead.id, booking.leadId))
        )
        .where(
          and(
            eq(booking.id, bookingId),
            byOwner ? eq(booking.organizationId, byOwner.organizationId) : undefined
          )
        )
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
      // No actor when the customer did it, not a login.
      await recordActivity(
        organizationId,
        {
          contactId: row.contactId,
          type: "booking_cancelled",
          payload: { bookingId },
          actorUserId: byOwner?.actorUserId ?? null,
        },
        tx
      );
      // The emails, as jobs saved with the cancel (decision 1 of the background runner). The
      // business's notification only when the customer cancelled: the owner knows what they did.
      await enqueueBookingEmails(
        tx,
        organizationId,
        bookingId,
        byOwner
          ? ["booking_cancellation"]
          : ["booking_cancellation", "booking_cancellation_notification"],
        0
      );
      // The event, wherever it is now: its saved id, or with none saved yet the id of the last
      // write (decision 6). Only a cancel that changed something adds it, so a second press never
      // does.
      await enqueueBookingEventJob(tx, {
        name: jobNames.bookingEventRemove,
        payload: {
          organizationId,
          bookingId,
          personId: row.personId,
          eventId: row.calendarEventId ?? calendarEventIdOf(bookingId, row.sequence),
        },
      });
      // The booked person hears it is off their day (feature 8c), only from a cancel that changed
      // something, so a second press never adds it.
      await enqueueWorkerText(tx, {
        organizationId,
        bookingId,
        personId: row.personId,
        sequence: row.sequence,
        changedAt: now.toISOString(),
        kind: "removed",
        startsAt: row.startsAt.toISOString(),
      });
      return { cancelled: true, alreadyCancelled: false } as const;
    });
  } catch (error) {
    // Never the database's own error: its message carries the query.
    throw new Error(`Cancelling a booking failed: ${safeErrorReason(error)}`);
  }
  return result;
}
