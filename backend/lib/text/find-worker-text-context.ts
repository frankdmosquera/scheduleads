// Backend: what a worker's text needs, read afresh inside its own business when the job runs
// (feature 8c, decision 5): the booking's state, time and person now, the customer's name, the
// service, the room, the address, and the business's name and time zone. Null when the booking,
// or its business, is gone.

import { and, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  availabilityRule,
  booking,
  bookingLink,
  contact,
  lead,
  organization,
  resource,
} from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export type WorkerTextContextType = {
  status: string;
  sequence: number;
  startsAt: Date;
  personId: string; // who has the booking now
  contactId: string;
  customerName: string;
  serviceName: string;
  placeName: string | null;
  location: string;
  businessName: string;
  timezone: string | null; // from the business's bookable hours; null before it has any
};

const place = alias(resource, "place");

export async function findWorkerTextContext(
  organizationId: string,
  bookingId: string
): Promise<WorkerTextContextType | null> {
  const [row] = await db
    .select({
      status: booking.status,
      sequence: booking.sequence,
      startsAt: booking.startsAt,
      personId: booking.personId,
      contactId: contact.id,
      customerName: contact.name,
      serviceName: bookingLink.name,
      placeName: place.name,
      location: booking.location,
      businessName: organization.name,
      timezone: availabilityRule.timezone,
    })
    .from(booking)
    .innerJoin(organization, eq(organization.id, booking.organizationId))
    .innerJoin(
      lead,
      and(eq(lead.organizationId, booking.organizationId), eq(lead.id, booking.leadId))
    )
    .innerJoin(
      contact,
      and(eq(contact.organizationId, booking.organizationId), eq(contact.id, lead.contactId))
    )
    .innerJoin(
      bookingLink,
      and(
        eq(bookingLink.organizationId, booking.organizationId),
        eq(bookingLink.id, booking.bookingLinkId)
      )
    )
    .leftJoin(
      place,
      and(eq(place.organizationId, booking.organizationId), eq(place.id, booking.placeId))
    )
    .leftJoin(
      availabilityRule,
      and(
        eq(availabilityRule.organizationId, booking.organizationId),
        isNull(availabilityRule.resourceId)
      )
    )
    .where(and(eq(booking.organizationId, organizationId), eq(booking.id, bookingId)))
    .limit(1);
  return row ?? null;
}
