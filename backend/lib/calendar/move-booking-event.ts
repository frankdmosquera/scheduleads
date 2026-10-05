// Backend: makes a moved booking's event follow it (feature 7b), read when its job runs. The saved
// event gets the new start and end (decision 7, never deleted and written again); one not there
// is written afresh. With none saved, as after a change of person or while an earlier write had
// not saved its id, the event is written into the booked person's calendar under this move's own
// id; whatever was there before goes by a removal job of its own (decision 6). Nothing for a
// booking no longer confirmed, or for a person with no calendar. Throws on any failure; the move
// is kept either way and its job tries again.

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule, booking } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { getFreshAccessToken } from "./get-fresh-access-token.js";
import { writeBookingEvent } from "./write-booking-event.js";

export type BookingEventMoveType = "moved" | "written" | "nothing";

export async function moveBookingEvent(
  organizationId: string,
  bookingId: string
): Promise<BookingEventMoveType> {
  const [row] = await db
    .select({
      personId: booking.personId,
      status: booking.status,
      calendarEventId: booking.calendarEventId,
      sequence: booking.sequence,
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
  if (row.status !== "confirmed") return "nothing"; // cancelled meanwhile: the cancel's removal runs

  const written = async () =>
    (await writeBookingEvent(organizationId, bookingId)) ? ("written" as const) : "nothing";
  const eventId = row.calendarEventId;
  if (!eventId) return written();

  const access = await getFreshAccessToken({ organizationId, resourceId: row.personId });
  if (!access) return "nothing"; // no calendar connected
  const moved = await access.provider.updateEventTime(access.accessToken, eventId, {
    start: row.startsAt,
    end: row.endsAt, // the appointment itself, not its buffers
    timezone: row.timezone,
  });
  if (moved) return "moved";
  // Not there any more: forgotten while the booking still names it, then written afresh under
  // this move's own id, so never refused.
  await db
    .update(booking)
    .set({ calendarEventId: null })
    .where(
      and(
        eq(booking.organizationId, organizationId),
        eq(booking.id, bookingId),
        eq(booking.calendarEventId, eventId)
      )
    );
  return written();
}
