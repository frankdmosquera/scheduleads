// Backend: marks a person or a place off over a span (feature 12b), all or nothing (decision 3):
// every booking in the way must carry the owner's choice, cancel or move; then one transaction
// cancels, moves and holds the time off, with the customers' messages and the Google events saved
// as jobs inside it. A move or the time off itself taken meanwhile, or a booking in the way changed
// meanwhile, undoes the lot.

import { and, asc, eq, inArray } from "drizzle-orm";

import { booking, resource } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { applyBookingMove } from "../booking/apply-booking-move.js";
import { cancelBookingInTransaction } from "../booking/cancel-booking-in-transaction.js";
import { EveryChoiceTakenError } from "../booking/every-choice-taken-error.js";
import {
  prepareBookingMove,
  type BookingMovePlanType,
  type MoveRefusalType,
} from "../booking/prepare-booking-move.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";
import { findCommitments } from "../scheduling/find-commitments.js";
import { holdTime } from "../scheduling/hold-time.js";
import { findBookingsInTheWay, type BookingInTheWayType } from "./find-bookings-in-the-way.js";

export type TimeOffChoiceType =
  | { bookingId: string; action: "cancel" }
  | { bookingId: string; action: "move"; startsAt: Date; personId: string };

export type TimeOffSavedType =
  | { ok: true; timeOff: { id: string; startsAt: Date; endsAt: Date } }
  | { ok: false; reason: "not_found" }
  // Time off already in the span: removed first, never merged.
  | { ok: false; reason: "already_off"; timeOff: { startsAt: Date; endsAt: Date } }
  // A booking in the way without a choice, a choice for one not in the way, or one already begun.
  | { ok: false; reason: "bookings_in_the_way"; bookings: BookingInTheWayType[] }
  | { ok: false; reason: "move_refused"; bookingId: string; why: MoveRefusalType }
  | { ok: false; reason: "move_into_time_off"; bookingId: string } // moved inside the span itself
  | { ok: false; reason: "person_not_offered"; bookingId: string } // moved to someone who does not do it
  | { ok: false; reason: "time_taken" }; // a move's time or the span taken meanwhile

// Thrown inside the transaction when a booking changed under it, so all of it is undone.
class ChangedMeanwhileError extends Error {}

export async function saveTimeOff({
  organizationId, // from the session, never from the request
  actorUserId,
  resourceId,
  startsAt,
  endsAt,
  choices,
  now,
}: {
  organizationId: string;
  actorUserId: string;
  resourceId: string;
  startsAt: Date;
  endsAt: Date;
  choices: TimeOffChoiceType[];
  now: Date;
}): Promise<TimeOffSavedType> {
  if (!(startsAt < endsAt)) throw new Error("Time off must end after it starts.");

  const [shown] = await db
    .select({ id: resource.id, kind: resource.kind })
    .from(resource)
    .where(and(eq(resource.organizationId, organizationId), eq(resource.id, resourceId)))
    .limit(1);
  if (!shown) return { ok: false, reason: "not_found" };

  // Said before any booking is chosen for, so the owner never chooses for a save that cannot go.
  const offAlready = (await findCommitments(organizationId, [resourceId], startsAt, endsAt)).find(
    (row) => row.kind === "time_off"
  );
  if (offAlready) {
    return {
      ok: false,
      reason: "already_off",
      timeOff: { startsAt: offAlready.startsAt, endsAt: offAlready.endsAt },
    };
  }

  // Every booking in the way has exactly one choice, and no choice names a booking that is not.
  const inTheWay = await findBookingsInTheWay({
    organizationId,
    resourceId,
    startsAt,
    endsAt,
    now,
  });
  const wayIds = new Set(inTheWay.map((one) => one.id));
  const chosen = new Map(choices.map((choice) => [choice.bookingId, choice]));
  const everyoneChosen =
    inTheWay.every((one) => chosen.has(one.id)) &&
    choices.every((choice) => wayIds.has(choice.bookingId));
  if (!everyoneChosen || inTheWay.some((one) => one.started)) {
    return { ok: false, reason: "bookings_in_the_way", bookings: inTheWay };
  }

  // Each move checked as the owner books: any time nobody is busy, its own old time not in the way.
  const byOwner = { organizationId, actorUserId };
  const plans: BookingMovePlanType[] = [];
  for (const choice of choices) {
    if (choice.action !== "move") continue;
    const moving = inTheWay.find((one) => one.id === choice.bookingId)!;
    if (!moving.people.some((person) => person.id === choice.personId)) {
      return { ok: false, reason: "person_not_offered", bookingId: choice.bookingId };
    }
    // Moved to the same person inside the span it would only be in the way again.
    if (choice.personId === resourceId && choice.startsAt < endsAt) {
      const length = moving.endsAt.getTime() - moving.startsAt.getTime();
      if (choice.startsAt.getTime() + length > startsAt.getTime()) {
        return { ok: false, reason: "move_into_time_off", bookingId: choice.bookingId };
      }
    }
    const prepared = await prepareBookingMove({
      bookingId: choice.bookingId,
      startsAt: choice.startsAt,
      personId: choice.personId,
      now,
      byOwner,
      // A room going off: the booking leaves it, never moved into it over the time off.
      ...(shown.kind === "place" && { leavingPlace: { placeId: resourceId, startsAt, endsAt } }),
    });
    // Moved to the time it already has, it would still be in the way.
    if (!prepared.ready) {
      return {
        ok: false,
        reason: "move_refused",
        bookingId: choice.bookingId,
        why: prepared.unchanged ? "time_taken" : prepared.reason,
      };
    }
    plans.push(prepared.plan);
  }

  try {
    const id = await db.transaction(async (tx) => {
      // Every booking chosen for locked first, in one order, and still as the owner saw it: one its
      // customer moved or cancelled meanwhile is no longer the one chosen for.
      if (choices.length > 0) {
        const locked = await tx
          .select({
            id: booking.id,
            status: booking.status,
            startsAt: booking.startsAt,
            personId: booking.personId,
          })
          .from(booking)
          .where(
            and(
              eq(booking.organizationId, organizationId),
              inArray(
                booking.id,
                choices.map((choice) => choice.bookingId)
              )
            )
          )
          .orderBy(asc(booking.id))
          .for("update");
        for (const seen of inTheWay) {
          const current = locked.find((row) => row.id === seen.id);
          if (
            !current ||
            current.status !== "confirmed" ||
            current.startsAt.getTime() !== seen.startsAt.getTime() ||
            current.personId !== seen.personId
          ) {
            throw new ChangedMeanwhileError();
          }
        }
      }
      // The cancels, the moves, then the time off: one transaction, so all of it or none.
      for (const choice of choices) {
        if (choice.action !== "cancel") continue;
        const cancelled = await cancelBookingInTransaction(tx, choice.bookingId, now, byOwner);
        if (!cancelled.cancelled || cancelled.alreadyCancelled) throw new ChangedMeanwhileError();
      }
      for (const plan of plans) {
        const moved = await applyBookingMove(tx, plan);
        if (!moved.moved || moved.unchanged) throw new ChangedMeanwhileError();
      }
      // Held last: a booking that landed in the span meanwhile, or a move into it, is refused here.
      const held = await holdTime(
        organizationId,
        { resourceIds: [resourceId], startsAt, endsAt, kind: "time_off" },
        tx
      );
      if (!held.held) throw new EveryChoiceTakenError();
      return held.ids[0];
    });
    return { ok: true, timeOff: { id, startsAt, endsAt } };
  } catch (error) {
    if (error instanceof EveryChoiceTakenError || error instanceof ChangedMeanwhileError) {
      return { ok: false, reason: "time_taken" };
    }
    // Never the database's own error: its message carries the query.
    throw new Error(`Saving time off failed: ${safeErrorReason(error)}`);
  }
}
