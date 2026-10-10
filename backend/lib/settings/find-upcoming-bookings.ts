// Backend: a business's confirmed bookings still to come, with what the Hours card lists for each:
// the customer, the service and the person. One person's only, when a person's card is saved.

import { and, asc, eq, gt } from "drizzle-orm";

import { booking, bookingLink, contact, lead, resource } from "@scheduleads-app/shared/db";

import type { DatabaseExecutorType } from "../../database-executor-type.js";

export type UpcomingBookingType = {
  bookingId: string;
  leadId: string;
  personId: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  customerName: string;
  serviceName: string;
  personName: string;
};

export async function findUpcomingBookings(
  executor: DatabaseExecutorType,
  organizationId: string,
  now: Date,
  personId: string | null // null = everyone's
): Promise<UpcomingBookingType[]> {
  // Every join stays inside the business, as the composite keys do.
  return executor
    .select({
      bookingId: booking.id,
      leadId: booking.leadId,
      personId: booking.personId,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      status: booking.status,
      customerName: contact.name,
      serviceName: bookingLink.name,
      personName: resource.name,
    })
    .from(booking)
    .innerJoin(
      lead,
      and(eq(lead.organizationId, booking.organizationId), eq(lead.id, booking.leadId))
    )
    .innerJoin(
      contact,
      and(eq(contact.organizationId, lead.organizationId), eq(contact.id, lead.contactId))
    )
    .innerJoin(
      bookingLink,
      and(
        eq(bookingLink.organizationId, booking.organizationId),
        eq(bookingLink.id, booking.bookingLinkId)
      )
    )
    .innerJoin(
      resource,
      and(eq(resource.organizationId, booking.organizationId), eq(resource.id, booking.personId))
    )
    .where(
      and(
        eq(booking.organizationId, organizationId),
        eq(booking.status, "confirmed"),
        gt(booking.startsAt, now),
        personId ? eq(booking.personId, personId) : undefined
      )
    )
    .orderBy(asc(booking.startsAt), asc(booking.id));
}
