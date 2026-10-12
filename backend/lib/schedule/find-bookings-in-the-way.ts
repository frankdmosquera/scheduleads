// Backend: the active bookings a span of time off for one person or place would cover (feature
// 12b), with what the owner needs to choose for each: its customer, service and time, and who could
// take it instead.

import { and, eq, inArray } from "drizzle-orm";

import { booking, bookingLink, contact, lead, resource } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { findCommitments } from "../scheduling/find-commitments.js";
import { findServiceResources } from "../scheduling/find-service-resources.js";

export type BookingInTheWayType = {
  id: string;
  customerName: string;
  serviceName: string;
  startsAt: Date;
  endsAt: Date;
  personId: string;
  started: boolean; // already begun: it can be neither moved nor cancelled any more
  people: { id: string; name: string }[]; // who could do it, for a move to someone else
};

export async function findBookingsInTheWay({
  organizationId, // from the session, never from the request
  resourceId,
  startsAt,
  endsAt,
  now,
}: {
  organizationId: string;
  resourceId: string;
  startsAt: Date;
  endsAt: Date;
  now: Date;
}): Promise<BookingInTheWayType[]> {
  // The held time includes each booking's buffers: time off over a buffer is in the way too.
  const held = await findCommitments(organizationId, [resourceId], startsAt, endsAt);
  const bookingIds = [...new Set(held.flatMap((row) => (row.bookingId ? [row.bookingId] : [])))];
  if (bookingIds.length === 0) return [];

  const rows = await db
    .select({
      id: booking.id,
      bookingLinkId: booking.bookingLinkId,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      personId: booking.personId,
      customerName: contact.name,
      serviceName: bookingLink.name,
    })
    .from(booking)
    .innerJoin(lead, and(eq(lead.organizationId, organizationId), eq(lead.id, booking.leadId)))
    .innerJoin(
      contact,
      and(eq(contact.organizationId, organizationId), eq(contact.id, lead.contactId))
    )
    .innerJoin(
      bookingLink,
      and(eq(bookingLink.organizationId, organizationId), eq(bookingLink.id, booking.bookingLinkId))
    )
    .where(
      and(
        eq(booking.organizationId, organizationId),
        inArray(booking.id, bookingIds),
        eq(booking.status, "confirmed")
      )
    );

  const people = await db
    .select({ id: resource.id, name: resource.name })
    .from(resource)
    .where(
      and(
        eq(resource.organizationId, organizationId),
        eq(resource.kind, "person"),
        eq(resource.active, true)
      )
    );
  const offeredByService = new Map<string, string[]>();
  for (const serviceId of new Set(rows.map((row) => row.bookingLinkId))) {
    const offered = await findServiceResources(organizationId, serviceId, {
      serviceMayBeOff: true,
    });
    offeredByService.set(serviceId, offered?.peopleIds ?? []);
  }

  return rows
    .map(({ bookingLinkId, ...row }) => ({
      ...row,
      started: row.startsAt.getTime() <= now.getTime(),
      people: people.filter((person) => offeredByService.get(bookingLinkId)?.includes(person.id)),
    }))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
