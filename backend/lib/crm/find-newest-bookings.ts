// Backend: each lead's newest booking, with its service's name, read inside one business. A lead
// normally has at most one (a move changes the same row), but the table allows more.

import { and, desc, eq, inArray } from "drizzle-orm";

import { booking, bookingLink } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export type NewestBookingType = {
  serviceName: string;
  startsAt: Date;
  status: "confirmed" | "cancelled";
};

export async function findNewestBookings(
  organizationId: string,
  leadIds: string[]
): Promise<Map<string, NewestBookingType>> {
  const newest = new Map<string, NewestBookingType>();
  if (leadIds.length === 0) return newest;

  const rows = await db
    .select({
      leadId: booking.leadId,
      serviceName: bookingLink.name,
      startsAt: booking.startsAt,
      status: booking.status,
    })
    .from(booking)
    .innerJoin(
      bookingLink,
      and(
        eq(bookingLink.organizationId, booking.organizationId),
        eq(bookingLink.id, booking.bookingLinkId)
      )
    )
    .where(and(eq(booking.organizationId, organizationId), inArray(booking.leadId, leadIds)))
    .orderBy(desc(booking.createdAt), desc(booking.id));

  for (const { leadId, status, ...rest } of rows) {
    // Newest first, so the first row seen for a lead is the one kept.
    if (!newest.has(leadId))
      newest.set(leadId, { ...rest, status: status === "cancelled" ? "cancelled" : "confirmed" });
  }
  return newest;
}
