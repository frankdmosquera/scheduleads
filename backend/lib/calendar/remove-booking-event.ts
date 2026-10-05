// Backend: takes a booking's events out of one person's calendar (features 7a and 7b), the person
// and the ids named when its job was added (decision 6): where the booking is now does not
// matter, so an event left behind by a move or a cancel goes even after later changes. An event
// already gone counts as removed. When the booking still names one of them, it forgets it. With
// no calendar connected there is nothing to remove. Throws on any failure; the cancel or move is
// kept either way and its job tries again.

import { and, eq, inArray } from "drizzle-orm";

import { booking } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { getFreshAccessToken } from "./get-fresh-access-token.js";

// true when the calendar was asked to remove them.
export async function removeBookingEvent(
  organizationId: string,
  bookingId: string,
  personId: string,
  eventIds: string[]
): Promise<boolean> {
  const access = await getFreshAccessToken({ organizationId, resourceId: personId });
  if (!access) return false; // no calendar connected: nothing was ever written

  for (const eventId of eventIds) {
    await access.provider.deleteEvent(access.accessToken, eventId); // gone already counts as done
  }
  await db
    .update(booking)
    .set({ calendarEventId: null })
    .where(
      and(
        eq(booking.organizationId, organizationId),
        eq(booking.id, bookingId),
        inArray(booking.calendarEventId, eventIds)
      )
    );
  return true;
}
