// Backend: moves one booking to another time, the customer's own act through their private link
// (feature 7b). Changing the time is booking again (decision 10): the new start must be one of the
// free times for this booking, any available or the person picked, with its own old time never in
// the way. Then one transaction, the booking row locked: the old held time released, the new held,
// the booking's times, person, room and invite number saved, and a booking_moved entry, or nothing
// changes. Until the appointment starts (decision 12). The same start again is one move (decision 4).
// Saved with it, as jobs: the booked person's Google event following it and both sides told, so
// the answer waits for neither.

import { and, eq } from "drizzle-orm";

import { booking, bookingLink, commitment, lead } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { resolveBookableHours } from "../bookable-hours/resolve-bookable-hours.js";
import { calendarEventIdOf } from "../calendar/calendar-event-id-of.js";
import { CalendarUnavailableError } from "../calendar/calendar-unavailable-error.js";
import { recordActivity } from "../crm/record-activity.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";
import { enqueueBookingEmails } from "../jobs/enqueue-booking-emails.js";
import { enqueueBookingEventJob } from "../jobs/enqueue-booking-event-job.js";
import { enqueueBookingTexts } from "../jobs/enqueue-booking-texts.js";
import { jobNames } from "../jobs/job-names.js";
import { localDate } from "../local-time/local-date.js";
import { appointmentSpan } from "../scheduling/appointment-span.js";
import { countBookingsThatDay } from "../scheduling/count-bookings-that-day.js";
import { findCommitments } from "../scheduling/find-commitments.js";
import { findResourceNames } from "../scheduling/find-resource-names.js";
import { findFreeTimes } from "../scheduling/find-free-times.js";
import { findServiceResources } from "../scheduling/find-service-resources.js";
import { findStandbyDates } from "../scheduling/find-standby-dates.js";
import { isRoomFree } from "../scheduling/is-room-free.js";
import { orderAnyAvailable } from "../scheduling/order-any-available.js";
import { releaseTime } from "../scheduling/release-time.js";
import { holdFirstFreeChoice } from "./hold-first-free-choice.js";

export type MoveBookingResultType =
  | { moved: true; unchanged: boolean } // unchanged: it was already there (decision 4)
  | {
      moved: false;
      reason: "not_found" | "already_cancelled" | "already_started" | "time_taken" | "unavailable";
    };

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

// Thrown inside the transaction when every choice was taken meanwhile, so all of it is undone.
class EveryChoiceTakenError extends Error {}

// The booking id comes from a verified link (decision 10); its business comes from the row.
export async function moveBooking(input: {
  bookingId: string;
  startsAt: Date; // the new start, one of the free times offered
  personId: string | null; // null = any available
  now: Date;
}): Promise<MoveBookingResultType> {
  const { bookingId, startsAt, personId, now } = input;
  if (Number.isNaN(startsAt.getTime())) throw new Error("Moving failed: the start is not a time.");

  const [current] = await db
    .select({
      organizationId: booking.organizationId,
      bookingLinkId: booking.bookingLinkId,
      personId: booking.personId,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      status: booking.status,
    })
    .from(booking)
    .where(eq(booking.id, bookingId))
    .limit(1);
  if (!current) return { moved: false, reason: "not_found" };
  if (current.status === "cancelled") return { moved: false, reason: "already_cancelled" };
  if (current.startsAt.getTime() <= now.getTime()) {
    return { moved: false, reason: "already_started" };
  }
  const alreadyThere = (row: { startsAt: Date; personId: string }) =>
    row.startsAt.getTime() === startsAt.getTime() &&
    (personId === null || row.personId === personId);
  if (alreadyThere(current)) return { moved: true, unchanged: true };

  const { organizationId, bookingLinkId } = current;
  const hours = await resolveBookableHours(organizationId, null, now);
  if (!hours) return { moved: false, reason: "not_found" };
  const { timezone } = hours;

  // The booking's own service, switched off or not (decision 13).
  const [service] = await db
    .select({
      durationMinutes: bookingLink.durationMinutes,
      bufferBeforeMinutes: bookingLink.bufferBeforeMinutes,
      bufferAfterMinutes: bookingLink.bufferAfterMinutes,
    })
    .from(bookingLink)
    .where(and(eq(bookingLink.organizationId, organizationId), eq(bookingLink.id, bookingLinkId)))
    .limit(1);
  const offered = await findServiceResources(organizationId, bookingLinkId, {
    serviceMayBeOff: true,
  });
  if (!service || !offered) return { moved: false, reason: "not_found" };
  if (personId !== null && !offered.peopleIds.includes(personId)) {
    return { moved: false, reason: "not_found" };
  }

  const date = localDate(startsAt, timezone);
  const { spanStart, spanEnd } = appointmentSpan(startsAt.getTime(), service);
  const span = { startsAt: new Date(spanStart), endsAt: new Date(spanEnd) };
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * MINUTE_MS);
  const ignoreBooking = {
    id: bookingId,
    personId: current.personId,
    startsAt: current.startsAt,
    endsAt: current.endsAt,
  };

  // Checked again: the start must still be one of this booking's free times for each candidate.
  const isFree = async (id: string): Promise<"free" | "busy" | "unreadable"> => {
    try {
      const answer = await findFreeTimes({
        organizationId,
        bookingLinkId,
        personId: id,
        fromDate: date,
        toDate: date,
        now,
        ignoreBooking,
      });
      return answer?.startTimes.includes(startsAt.toISOString()) ? "free" : "busy";
    } catch (error) {
      if (error instanceof CalendarUnavailableError) return "unreadable"; // logged there
      throw error;
    }
  };
  const candidates = personId === null ? offered.peopleIds : [personId];
  const states = await Promise.all(candidates.map(isFree));
  if (personId !== null && states[0] === "unreadable")
    return { moved: false, reason: "unavailable" };
  const freePeople = candidates.filter((_, i) => states[i] === "free");
  if (freePeople.length === 0) {
    return { moved: false, reason: states.includes("unreadable") ? "unavailable" : "time_taken" };
  }

  // The rooms, the booking's own held rows left out.
  let freeRooms: { resourceId: string; name: string }[] | null = null;
  if (offered.placeIds !== null) {
    const [taken, standby, rooms] = await Promise.all([
      findCommitments(organizationId, offered.placeIds, span.startsAt, span.endsAt),
      findStandbyDates(organizationId, offered.placeIds, date, date),
      findResourceNames(organizationId, offered.placeIds),
    ]);
    freeRooms = rooms.filter((room) =>
      isRoomFree(
        {
          busy: taken
            .filter((row) => row.resourceId === room.resourceId && row.bookingId !== bookingId)
            .map((row) => ({ start: row.startsAt, end: row.endsAt })),
          standbyDates: standby
            .filter((row) => row.resourceId === room.resourceId)
            .map((row) => row.date),
        },
        date,
        spanStart,
        spanEnd
      )
    );
    if (freeRooms.length === 0) return { moved: false, reason: "time_taken" };
  }

  // Any available's own order (fewest bookings that day first), this booking not counted.
  const dayRows = (
    await findCommitments(
      organizationId,
      freePeople,
      new Date(startsAt.getTime() - DAY_MS),
      new Date(startsAt.getTime() + DAY_MS)
    )
  ).filter((row) => row.bookingId !== bookingId);
  const counts = countBookingsThatDay(dayRows, date, timezone);
  const people = (await findResourceNames(organizationId, freePeople)).map((person) => ({
    ...person,
    bookingsThatDay: counts.get(person.resourceId) ?? 0,
  }));
  const choices = orderAnyAvailable(people, freeRooms);

  let result: MoveBookingResultType;
  try {
    result = await db.transaction(async (tx) => {
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
      if (!row) return { moved: false, reason: "not_found" } as const;
      if (row.status === "cancelled") return { moved: false, reason: "already_cancelled" } as const;
      if (row.startsAt.getTime() <= now.getTime()) {
        return { moved: false, reason: "already_started" } as const;
      }
      if (alreadyThere(row)) return { moved: true, unchanged: true } as const; // a move a moment ago

      // Released before the new rows go in: the overlap rule would refuse a new span that
      // overlaps the booking's own old one otherwise.
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
      // actorUserId stays null: the customer did it, not a login.
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
        },
        tx
      );
      // The two emails, as jobs saved with the move (decision 1 of the background runner).
      await enqueueBookingEmails(
        tx,
        organizationId,
        bookingId,
        ["booking_move", "booking_move_notification"],
        sequence
      );
      // The reminders again, at the new time (feature 8b, decision 6): the old ones see this
      // move's number and stay quiet.
      await enqueueBookingTexts(tx, {
        organizationId,
        bookingId,
        sequence,
        startsAt,
        now,
        confirmation: false,
      });
      // The event follows as jobs (decisions 5 and 6): the saved event is updated in place for
      // the same person. For another person, or with no id saved yet, the old event is taken out
      // and the new one written, each on its own. With none saved, the event can only be under
      // the id of the write just before this move: any earlier one was taken out by its own
      // change.
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
      return { moved: true, unchanged: false } as const;
    });
  } catch (error) {
    if (error instanceof EveryChoiceTakenError) return { moved: false, reason: "time_taken" };
    // Never the database's own error: its message carries the query.
    throw new Error(`Moving a booking failed: ${safeErrorReason(error)}`);
  }
  return result;
}
