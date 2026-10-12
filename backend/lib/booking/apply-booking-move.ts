// Backend: makes a prepared move inside the caller's transaction (feature 7b; the owner's, 12b): the
// booking row locked, the old held time released, the new held, the booking's times, person, room
// and invite number saved, a booking_moved entry, and as jobs the Google event following it and
// the people told. Throws EveryChoiceTakenError when every choice was taken meanwhile, so the
// caller's whole transaction is undone.

import { and, eq } from "drizzle-orm";

import { booking, commitment, lead } from "@scheduleads-app/shared/db";

import type { DatabaseExecutorType } from "../../database-executor-type.js";
import { calendarEventIdOf } from "../calendar/calendar-event-id-of.js";
import { recordActivity } from "../crm/record-activity.js";
import { enqueueBookingEmails } from "../jobs/enqueue-booking-emails.js";
import { enqueueBookingEventJob } from "../jobs/enqueue-booking-event-job.js";
import { enqueueBookingTexts } from "../jobs/enqueue-booking-texts.js";
import { enqueueWorkerText } from "../jobs/enqueue-worker-text.js";
import { jobNames } from "../jobs/job-names.js";
import { releaseTime } from "../scheduling/release-time.js";
import { EveryChoiceTakenError } from "./every-choice-taken-error.js";
import { holdFirstFreeChoice } from "./hold-first-free-choice.js";
import type { BookingMovePlanType } from "./prepare-booking-move.js";

export type BookingMoveAppliedType =
  | { moved: true; unchanged: boolean }
  | { moved: false; reason: "not_found" | "already_cancelled" | "already_started" };

export async function applyBookingMove(
  tx: DatabaseExecutorType,
  plan: BookingMovePlanType
): Promise<BookingMoveAppliedType> {
  const { organizationId, bookingId, startsAt, endsAt, span, personId, choices, now } = plan;

  // Locked first, so two moves (or a move and a cancel) at the same instant make one outcome.
  const [row] = await tx
    .select({
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
    .where(and(eq(booking.organizationId, organizationId), eq(booking.id, bookingId)))
    .for("update", { of: booking })
    .limit(1);
  if (!row) return { moved: false, reason: "not_found" };
  if (row.status === "cancelled") return { moved: false, reason: "already_cancelled" };
  if (row.startsAt.getTime() <= now.getTime()) return { moved: false, reason: "already_started" };
  // A move a moment ago (decision 4).
  if (
    row.startsAt.getTime() === startsAt.getTime() &&
    (personId === null || row.personId === personId)
  ) {
    return { moved: true, unchanged: true };
  }

  // Released before the new rows go in: the overlap rule would refuse a new span that overlaps the
  // booking's own old one otherwise.
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
    held.map((heldRow) => heldRow.id),
    tx
  );
  const chosen = await holdFirstFreeChoice(organizationId, choices, span, bookingId, tx);
  if (!chosen) throw new EveryChoiceTakenError();

  const sequence = row.sequence + 1;
  const personChanged = chosen.personId !== row.personId;
  await tx
    .update(booking)
    .set({
      startsAt,
      endsAt,
      personId: chosen.personId,
      placeId: chosen.placeId,
      sequence,
      // Another person's calendar holds the old event: the new person's is written afresh.
      ...(personChanged && { calendarEventId: null }),
    })
    .where(and(eq(booking.organizationId, organizationId), eq(booking.id, bookingId)));
  // The owner's login when the owner moved it; null when the customer did, not a login.
  await recordActivity(
    organizationId,
    {
      contactId: row.contactId,
      type: "booking_moved",
      payload: {
        bookingId,
        fromStartsAt: row.startsAt.toISOString(),
        toStartsAt: startsAt.toISOString(),
        fromPersonId: row.personId,
        toPersonId: chosen.personId, // the move's emails name this person, even sent late
        sequence,
      },
      actorUserId: plan.actorUserId,
    },
    tx
  );
  // The emails, as jobs saved with the move (decision 1 of the background runner). The business's
  // notification only when the customer moved it: the owner knows what they did.
  await enqueueBookingEmails(
    tx,
    organizationId,
    bookingId,
    plan.actorUserId ? ["booking_move"] : ["booking_move", "booking_move_notification"],
    sequence
  );
  // The reminders again, at the new time (feature 8b, decision 6): the old ones see this move's
  // number and stay quiet.
  await enqueueBookingTexts(tx, {
    organizationId,
    bookingId,
    sequence,
    startsAt,
    now,
    confirmation: false,
  });
  // The booked people's own texts (feature 8c): the same person hears it moved; for another person,
  // the first hears it is off their day, at the time they had, and the second gets it.
  const change = { organizationId, bookingId, sequence, changedAt: now.toISOString() };
  if (personChanged) {
    await enqueueWorkerText(tx, {
      ...change,
      personId: row.personId,
      kind: "removed",
      startsAt: row.startsAt.toISOString(),
    });
    await enqueueWorkerText(tx, {
      ...change,
      personId: chosen.personId,
      kind: "added",
      startsAt: null,
    });
  } else {
    await enqueueWorkerText(tx, {
      ...change,
      personId: chosen.personId,
      kind: "moved",
      startsAt: null,
    });
  }
  // The event follows as jobs (decisions 5 and 6): the saved event is updated in place for the same
  // person. For another person, or with no id saved yet, the old event is taken out and the new
  // one written, each on its own. With none saved, the event can only be under the id of the write
  // just before this move: any earlier one was taken out by its own change.
  await enqueueBookingEventJob(tx, {
    name: jobNames.bookingEventMove,
    payload: { organizationId, bookingId, sequence },
  });
  if (personChanged || !row.calendarEventId) {
    await enqueueBookingEventJob(tx, {
      name: jobNames.bookingEventRemove,
      payload: {
        organizationId,
        bookingId,
        personId: row.personId,
        eventId: row.calendarEventId ?? calendarEventIdOf(bookingId, row.sequence),
      },
    });
  }
  return { moved: true, unchanged: false };
}
