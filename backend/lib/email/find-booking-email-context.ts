// Backend: everything a booking's emails need, read inside its own business: the booking, the
// customer, the facts the templates show, and the business's sending setup, or what it still
// lacks (feature 6, decision 4: no sender, no email). The confirmation, the move and the
// cancellation all read it here.

import { and, eq } from "drizzle-orm";

import { booking, bookingLink, contact, lead, resource } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import type { BookingEmailFactsType } from "../../emails/booking-email-facts-type.js";
import { findBusinessEmailDetails } from "./find-business-email-details.js";
import { formatSender } from "./format-sender.js";

export type BookingEmailSetupType =
  | {
      ready: true;
      apiKey: string;
      senderEmail: string;
      notifyEmail: string;
      from: string; // "Primo Painters" <bookings@primopainters.com>
      facts: BookingEmailFactsType;
    }
  | { ready: false; missing: string[] }; // in words for the log line: "sender address", ...

export type BookingEmailContextType = {
  status: string;
  createdAt: Date;
  endsAt: Date; // the appointment itself, not its buffers
  sequence: number; // the invite number: 0 when made, one more each move
  contactId: string;
  source: string; // the lead's: "widget", "hosted" or "manual"
  customerName: string;
  customerEmail: string | null;
  setup: BookingEmailSetupType;
};

// Throws when the booking or the business cannot be read.
export async function findBookingEmailContext(
  organizationId: string,
  bookingId: string
): Promise<BookingEmailContextType> {
  const [row] = await db
    .select({
      status: booking.status,
      createdAt: booking.createdAt,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      sequence: booking.sequence,
      location: booking.location,
      service: bookingLink.name,
      personName: resource.name,
      contactId: contact.id,
      customerName: contact.name,
      customerEmail: contact.email,
      phone: lead.phone, // the one given with this booking
      contactPhone: contact.phone,
      details: lead.details,
      source: lead.source,
    })
    .from(booking)
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
      lead,
      and(eq(lead.organizationId, booking.organizationId), eq(lead.id, booking.leadId))
    )
    .innerJoin(
      contact,
      and(eq(contact.organizationId, booking.organizationId), eq(contact.id, lead.contactId))
    )
    .where(and(eq(booking.organizationId, organizationId), eq(booking.id, bookingId)))
    .limit(1);
  if (!row) throw new Error("Reading a booking's emails failed: no such booking in this business.");

  const business = await findBusinessEmailDetails(organizationId);
  if (!business) throw new Error("Reading a booking's emails failed: no such business.");

  const context = {
    status: row.status,
    createdAt: row.createdAt,
    endsAt: row.endsAt,
    sequence: row.sequence,
    contactId: row.contactId,
    source: row.source,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
  };
  const { senderEmail, notifyEmail, apiKey, timezone } = business;
  if (!senderEmail || !notifyEmail || !apiKey || !timezone) {
    const missing = [
      !senderEmail && "sender address",
      !notifyEmail && "notification address",
      !apiKey && "Resend key",
      !timezone && "time zone",
    ].filter((what): what is string => Boolean(what));
    return { ...context, setup: { ready: false, missing } };
  }

  return {
    ...context,
    setup: {
      ready: true,
      apiKey,
      senderEmail,
      notifyEmail,
      from: formatSender(business.name, senderEmail),
      facts: {
        business: {
          name: business.name,
          logo: business.logo,
          phone: business.phone,
          website: business.website,
          brandColor: business.brandColor,
          timezone,
        },
        service: row.service,
        startsAt: row.startsAt,
        personName: row.personName,
        location: row.location,
        customer: {
          name: row.customerName,
          email: row.customerEmail,
          phone: row.phone ?? row.contactPhone,
          details: row.details,
        },
      },
    },
  };
}
