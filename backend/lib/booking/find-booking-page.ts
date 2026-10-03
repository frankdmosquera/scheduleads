// Backend: what the customer's booking page shows of one booking: the service, when, with whom,
// and whose business it is. Never the customer's own details (decision 3): a forwarded email
// must not hand them on. Every join stays inside the booking's own business.

import { and, eq, isNull } from "drizzle-orm";

import {
  availabilityRule,
  booking,
  bookingLink,
  organization,
  resource,
} from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export type BookingPageType = {
  status: string; // "confirmed" or "cancelled"
  service: string;
  startsAt: string; // ISO 8601 in UTC
  endsAt: string; // the appointment's own end, without the buffer after
  timezone: string; // the business's IANA zone
  person: string; // the booked person's name
  business: {
    name: string;
    logo: string | null; // an absolute https:// image URL
    brandColor: string | null; // #rrggbb
    phone: string | null;
    website: string | null;
  };
};

// null when no such booking exists, or its business has no time zone.
export async function findBookingPage(bookingId: string): Promise<BookingPageType | null> {
  const [row] = await db
    .select({
      status: booking.status,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      service: bookingLink.name,
      person: resource.name,
      timezone: availabilityRule.timezone,
      businessName: organization.name,
      logo: organization.logo,
      brandColor: organization.brandColor,
      phone: organization.phone,
      website: organization.website,
    })
    .from(booking)
    .innerJoin(organization, eq(organization.id, booking.organizationId))
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
    .innerJoin(
      availabilityRule,
      and(
        eq(availabilityRule.organizationId, booking.organizationId),
        isNull(availabilityRule.resourceId) // the business's own hours carry its zone
      )
    )
    .where(eq(booking.id, bookingId))
    .limit(1);
  // Without the business's zone the page cannot say when; a booking is never made without one.
  if (!row?.timezone) return null;

  return {
    status: row.status,
    service: row.service,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    timezone: row.timezone,
    person: row.person,
    business: {
      name: row.businessName,
      logo: row.logo,
      brandColor: row.brandColor,
      phone: row.phone,
      website: row.website,
    },
  };
}
