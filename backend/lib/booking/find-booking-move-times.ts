// Backend: the times a customer could move their booking to (feature 7b). Changing the time is
// booking again (decision 10): the same service, any available or a person who offers it, read as
// for a new booking, except that the booking's own held time and its own Google event never stand
// in its way. It may move until the appointment starts (decision 12). Read inside its own business.

import { and, eq } from "drizzle-orm";

import { addDays } from "@scheduleads-app/shared/add-days";
import { booking, bookingLink } from "@scheduleads-app/shared/db";
import { localDate } from "@scheduleads-app/shared/local-date";

import { db } from "../../database.js";
import { resolveBookableHours } from "../bookable-hours/resolve-bookable-hours.js";
import { findFreeTimes, type FreeTimesType } from "../scheduling/find-free-times.js";

// The booking form's answer, plus the last date the business takes bookings, so the page stops
// offering later weeks there.
export type BookingMoveTimesType = FreeTimesType & { lastDate: string }; // YYYY-MM-DD, its zone

export type BookingMoveTimesResultType =
  | { state: "ok"; times: BookingMoveTimesType }
  | { state: "not_found" } // no such booking, its service is gone, or the person does not offer it
  | { state: "already_cancelled" }
  | { state: "already_started" }
  | { state: "person_not_taken" }; // a person asked for on a service the business assigns

// Throws CalendarUnavailableError, as findFreeTimes does, when the times cannot be read.
export async function findBookingMoveTimes(input: {
  bookingId: string; // from the signed link, never from the request otherwise
  personId: string | null; // null = any available
  fromDate: string; // YYYY-MM-DD in the business's zone
  toDate: string;
  now: Date;
}): Promise<BookingMoveTimesResultType> {
  const [row] = await db
    .select({
      organizationId: booking.organizationId,
      bookingLinkId: booking.bookingLinkId,
      personId: booking.personId,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      status: booking.status,
    })
    .from(booking)
    .where(eq(booking.id, input.bookingId))
    .limit(1);
  if (!row) return { state: "not_found" };
  if (row.status === "cancelled") return { state: "already_cancelled" };
  if (row.startsAt.getTime() <= input.now.getTime()) return { state: "already_started" };

  // Who picks the person (feature 9, decision 3): for a service the business assigns, nobody is
  // offered and nobody may be asked for. Its own service, switched off or not (decision 13).
  const [service] = await db
    .select({ personChoice: bookingLink.personChoice })
    .from(bookingLink)
    .where(
      and(eq(bookingLink.organizationId, row.organizationId), eq(bookingLink.id, row.bookingLinkId))
    )
    .limit(1);
  if (!service) return { state: "not_found" };
  const assigns = service.personChoice === "business_assigns";
  if (assigns && input.personId !== null) return { state: "person_not_taken" };

  const ask = (personId: string | null) =>
    findFreeTimes({
      organizationId: row.organizationId, // the booking's own business, from the booking row
      bookingLinkId: row.bookingLinkId,
      personId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      now: input.now,
      ignoreBooking: {
        id: input.bookingId,
        personId: row.personId,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
      },
    });
  // A move with nobody picked keeps her own person while free, and "try again" while their
  // calendar cannot be read (F-263, F-265): so the times say "try again" too, rather than list
  // times that would all fail (F-269). Thrown as CalendarUnavailableError, as any unreadable read.
  const [times] = await Promise.all([
    ask(input.personId),
    input.personId === null ? ask(row.personId) : null,
  ]);
  const hours = await resolveBookableHours(row.organizationId, null, input.now);
  if (!times || !hours) return { state: "not_found" };
  // The same horizon findFreeTimes stops at: today in the business's zone plus its days ahead.
  const lastDate = addDays(localDate(input.now, hours.timezone), hours.horizonDays);
  return { state: "ok", times: { ...times, people: assigns ? [] : times.people, lastDate } };
}
