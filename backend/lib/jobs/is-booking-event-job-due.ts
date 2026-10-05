// Backend: whether a write or a move of a booking's event still has work when its job runs
// (decisions 3 and 4). Not for a booking that is gone, nor once the appointment has started, nor
// once a later move added its own job, which puts the event where the booking is now.

import { and, eq } from "drizzle-orm";

import { booking } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { jobClock } from "./job-clock.js";

// sequence: the move number the job was added for, 0 for the booking itself.
export async function isBookingEventJobDue(
  organizationId: string,
  bookingId: string,
  sequence: number
): Promise<boolean> {
  const [row] = await db
    .select({ startsAt: booking.startsAt, sequence: booking.sequence })
    .from(booking)
    .where(and(eq(booking.organizationId, organizationId), eq(booking.id, bookingId)));
  if (!row) return false; // the booking, or its business, was removed
  if (row.startsAt.getTime() <= jobClock.now().getTime()) {
    console.warn(`[calendar] booking ${bookingId}: event not changed, the appointment has started`);
    return false;
  }
  return row.sequence === sequence;
}
