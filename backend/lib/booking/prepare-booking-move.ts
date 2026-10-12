// Backend: everything a booking's move checks before it changes anything (feature 7b): the booking
// is there and still ahead, the new start is free for it (its own old time never in the way), and
// who and which room can take it, in the order to try them. applyBookingMove then makes the change
// inside a transaction. The customer's move through their link, or the owner's (feature 12b): any
// time nobody is busy, as the owner books, never a start already past. A room going off (12b.3):
// the booking leaves it over its time off, so the same start in another room is a move.

import { and, eq } from "drizzle-orm";

import { booking, bookingLink } from "@scheduleads-app/shared/db";
import { localDate } from "@scheduleads-app/shared/local-date";

import { db } from "../../database.js";
import { resolveBookableHours } from "../bookable-hours/resolve-bookable-hours.js";
import { appointmentSpan } from "../scheduling/appointment-span.js";
import { findServiceResources } from "../scheduling/find-service-resources.js";
import { findBookingChoices, type BookingChoicesType } from "./find-booking-choices.js";

export type BookingMovePlanType = {
  organizationId: string;
  bookingId: string;
  startsAt: Date;
  endsAt: Date; // the appointment's end, without the buffer after
  span: { startsAt: Date; endsAt: Date }; // with both buffers
  personId: string | null; // asked for; null = any available
  choices: Extract<BookingChoicesType, { found: true }>["choices"];
  actorUserId: string | null; // the owner's login when the owner moves it
  leavingPlaceId: string | null; // the room going off: the same start elsewhere is no "already there"
  now: Date;
};

export type MoveRefusalType =
  | "not_found"
  | "already_cancelled"
  | "already_started"
  | "in_the_past"
  | "time_taken"
  | "unavailable"
  | "person_not_taken";

export type BookingMovePreparedType =
  | { ready: true; plan: BookingMovePlanType }
  | { ready: false; unchanged: true } // already there (decision 4)
  | { ready: false; unchanged: false; reason: MoveRefusalType };

const MINUTE_MS = 60_000;

export async function prepareBookingMove(input: {
  bookingId: string; // the customer's: from a verified link (decision 10); its business from the row
  startsAt: Date;
  personId: string | null;
  now: Date;
  // The owner's move: the booking must be this business's, and the login is the actor.
  byOwner?: { organizationId: string; actorUserId: string };
  // The owner marking a room off over a span (12b.3): the move keeps out of that room there.
  leavingPlace?: { placeId: string; startsAt: Date; endsAt: Date };
}): Promise<BookingMovePreparedType> {
  const { bookingId, startsAt, personId, now, byOwner, leavingPlace } = input;
  if (Number.isNaN(startsAt.getTime())) throw new Error("Moving failed: the start is not a time.");
  const refused = (reason: MoveRefusalType) =>
    ({ ready: false, unchanged: false, reason }) as const;

  const [current] = await db
    .select({
      organizationId: booking.organizationId,
      bookingLinkId: booking.bookingLinkId,
      personId: booking.personId,
      placeId: booking.placeId,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      status: booking.status,
    })
    .from(booking)
    .where(
      and(
        eq(booking.id, bookingId),
        byOwner ? eq(booking.organizationId, byOwner.organizationId) : undefined
      )
    )
    .limit(1);
  if (!current) return refused("not_found");
  if (current.status === "cancelled") return refused("already_cancelled");
  if (current.startsAt.getTime() <= now.getTime()) return refused("already_started");
  const leavingPlaceId =
    leavingPlace && current.placeId === leavingPlace.placeId ? leavingPlace.placeId : null;
  if (
    current.startsAt.getTime() === startsAt.getTime() &&
    (personId === null || current.personId === personId) &&
    leavingPlaceId === null
  ) {
    return { ready: false, unchanged: true };
  }
  // The owner moves work forward, never into time already gone.
  if (byOwner && startsAt.getTime() <= now.getTime()) return refused("in_the_past");

  const { organizationId, bookingLinkId } = current;
  const hours = await resolveBookableHours(organizationId, null, now);
  if (!hours) return refused("not_found");
  const { timezone } = hours;

  // The booking's own service, switched off or not (decision 13).
  const [service] = await db
    .select({
      durationMinutes: bookingLink.durationMinutes,
      bufferBeforeMinutes: bookingLink.bufferBeforeMinutes,
      bufferAfterMinutes: bookingLink.bufferAfterMinutes,
      personChoice: bookingLink.personChoice,
    })
    .from(bookingLink)
    .where(and(eq(bookingLink.organizationId, organizationId), eq(bookingLink.id, bookingLinkId)))
    .limit(1);
  const offered = await findServiceResources(organizationId, bookingLinkId, {
    serviceMayBeOff: true,
  });
  if (!service || !offered) return refused("not_found");
  // A customer never picks who does a service the business assigns (feature 9, decision 3); the
  // owner may. After "already there", so the same move pressed twice still answers the same.
  if (!byOwner && service.personChoice === "business_assigns" && personId !== null) {
    return refused("person_not_taken");
  }
  if (personId !== null && !offered.peopleIds.includes(personId)) return refused("not_found");

  const date = localDate(startsAt, timezone);
  const { spanStart, spanEnd } = appointmentSpan(startsAt.getTime(), service);
  const movingBooking = {
    id: bookingId,
    personId: current.personId,
    startsAt: current.startsAt,
    endsAt: current.endsAt,
  };

  // Checked again, as a new booking is, the booking's own time never in its way.
  const checked = await findBookingChoices({
    organizationId,
    bookingLinkId,
    offered,
    personId,
    startsAt,
    date,
    timezone,
    span: { spanStart, spanEnd },
    now,
    byOwner: byOwner !== undefined,
    movingBooking,
  });
  if (!checked.found) return refused(checked.reason);
  // The room going off reads free until its time off is held: kept out wherever the two overlap.
  const choices = leavingPlace
    ? checked.choices.filter(
        (choice) =>
          choice.placeId !== leavingPlace.placeId ||
          spanEnd <= leavingPlace.startsAt.getTime() ||
          spanStart >= leavingPlace.endsAt.getTime()
      )
    : checked.choices;
  if (choices.length === 0) return refused("time_taken");

  return {
    ready: true,
    plan: {
      organizationId,
      bookingId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + service.durationMinutes * MINUTE_MS),
      span: { startsAt: new Date(spanStart), endsAt: new Date(spanEnd) },
      personId,
      choices,
      actorUserId: byOwner?.actorUserId ?? null,
      leavingPlaceId,
      now,
    },
  };
}
