// Backend: what a booking's texts need, read afresh inside its own business when the job runs
// (feature 8b, decision 6): the booking's state and time, the customer's phone, and the business's
// name and time zone. Null when the booking, or its business, is gone.

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule, booking, contact, lead, organization } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export type BookingTextContextType = {
  status: string;
  sequence: number;
  startsAt: Date;
  createdAt: Date;
  contactId: string;
  phone: string | null; // the one given with this booking, else the contact's
  businessName: string;
  timezone: string | null; // from the business's bookable hours; null before it has any
};

export async function findBookingTextContext(
  organizationId: string,
  bookingId: string
): Promise<BookingTextContextType | null> {
  const [row] = await db
    .select({
      status: booking.status,
      sequence: booking.sequence,
      startsAt: booking.startsAt,
      createdAt: booking.createdAt,
      contactId: contact.id,
      leadPhone: lead.phone,
      contactPhone: contact.phone,
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
    .leftJoin(
      availabilityRule,
      and(
        eq(availabilityRule.organizationId, booking.organizationId),
        isNull(availabilityRule.resourceId)
      )
    )
    .where(and(eq(booking.organizationId, organizationId), eq(booking.id, bookingId)))
    .limit(1);
  if (!row) return null;
  const { leadPhone, contactPhone, ...context } = row;
  return { ...context, phone: leadPhone ?? contactPhone };
}
