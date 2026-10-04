// Backend: takes a cancelled booking's event out of the booked person's own calendar (feature 7a),
// and forgets its id on the booking. Removed by its saved id, wherever a move put it (feature 7b),
// or by the id made from the booking, so an event whose id was not saved yet (a cancel in the
// first moment after booking) goes too. Only a cancelled
// booking loses its event; with no calendar connected there is nothing to remove. Throws on any
// failure; the caller keeps the cancel either way (decision 5).

import { and, eq } from "drizzle-orm";

import { booking } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { calendarEventIdOf } from "./calendar-event-id-of.js";
import { getFreshAccessToken } from "./get-fresh-access-token.js";

// true when the calendar was asked to remove it.
export async function removeBookingEvent(
  organizationId: string,
  bookingId: string
): Promise<boolean> {
  const [row] = await db
    .select({
      personId: booking.personId,
      status: booking.status,
      calendarEventId: booking.calendarEventId,
    })
    .from(booking)
    .where(and(eq(booking.organizationId, organizationId), eq(booking.id, bookingId)))
    .limit(1);
  if (!row) throw new Error("Removing the event failed: no such booking in this business.");
  if (row.status !== "cancelled") return false;

  const access = await getFreshAccessToken({ organizationId, resourceId: row.personId });
  if (!access) return false; // no calendar connected: nothing was ever written

  await access.provider.deleteEvent(
    access.accessToken,
    row.calendarEventId ?? calendarEventIdOf(bookingId)
  );
  await db
    .update(booking)
    .set({ calendarEventId: null })
    .where(and(eq(booking.organizationId, organizationId), eq(booking.id, bookingId)));
  return true;
}
