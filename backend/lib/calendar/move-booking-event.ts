// Backend: makes a moved booking's event follow it (feature 7b). With the same person, the same
// event gets the new start and end (decision 7, never deleted and written again); one that is not
// there is written. With another person, it leaves the first person's calendar and is written into
// the new person's, under a fresh id so moving back later is never refused. Nothing for a booking
// no longer confirmed, or for a person with no calendar. Throws on any failure; the caller keeps
// the move either way (decision 5).

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule, booking } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { calendarEventIdOf } from "./calendar-event-id-of.js";
import { getFreshAccessToken } from "./get-fresh-access-token.js";
import { writeBookingEvent } from "./write-booking-event.js";

export type BookingEventMoveType = "moved" | "written" | "nothing";

// fromPersonId: who held the booking before the move, handed over by the move itself.
export async function moveBookingEvent(
  organizationId: string,
  bookingId: string,
  fromPersonId: string
): Promise<BookingEventMoveType> {
  const [row] = await db
    .select({
      personId: booking.personId,
      status: booking.status,
      calendarEventId: booking.calendarEventId,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      timezone: availabilityRule.timezone,
    })
    .from(booking)
    .innerJoin(
      availabilityRule,
      and(
        eq(availabilityRule.organizationId, booking.organizationId),
        isNull(availabilityRule.resourceId)
      )
    )
    .where(and(eq(booking.organizationId, organizationId), eq(booking.id, bookingId)))
    .limit(1);
  if (!row) throw new Error("Moving the event failed: no such booking in this business.");
  if (!row.timezone) throw new Error("Moving the event failed: the business has no time zone.");
  if (row.status !== "confirmed") return "nothing"; // cancelled meanwhile: the removal handles it

  // The event as it stands: its saved id, or the one made from the booking if it was written
  // before its id could be saved.
  const eventId = row.calendarEventId ?? calendarEventIdOf(bookingId);
  const forget = () =>
    db
      .update(booking)
      .set({ calendarEventId: null })
      .where(and(eq(booking.organizationId, organizationId), eq(booking.id, bookingId)));

  if (row.personId === fromPersonId) {
    const access = await getFreshAccessToken({ organizationId, resourceId: row.personId });
    if (!access) return "nothing"; // no calendar connected
    const moved = await access.provider.updateEventTime(access.accessToken, eventId, {
      start: row.startsAt,
      end: row.endsAt, // the appointment itself, not its buffers
      timezone: row.timezone,
    });
    if (moved) {
      if (!row.calendarEventId) {
        await db
          .update(booking)
          .set({ calendarEventId: eventId })
          .where(and(eq(booking.organizationId, organizationId), eq(booking.id, bookingId)));
      }
      return "moved";
    }
    await forget(); // not there: written afresh below
    return (await writeBookingEvent(organizationId, bookingId)) ? "written" : "nothing";
  }

  // Another person: out of the first person's calendar, then into the new person's.
  const from = await getFreshAccessToken({ organizationId, resourceId: fromPersonId });
  if (from) await from.provider.deleteEvent(from.accessToken, eventId);
  await forget();
  return (await writeBookingEvent(organizationId, bookingId)) ? "written" : "nothing";
}
