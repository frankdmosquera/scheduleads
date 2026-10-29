// Backend: everything a booking's emails need, read inside its own business: the booking, the
// customer, the facts the templates show, and the business's sending setup, or what it still
// lacks (feature 25a: only a time zone and somewhere for its notices). The confirmation, the
// move and the cancellation all read it here.

import { and, eq } from "drizzle-orm";

import { booking, bookingLink, contact, lead, resource } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import type { BookingEmailFactsType } from "../../emails/booking-email-facts-type.js";
import { publicPriceOf } from "../booking/public-price-of.js";
import { findBusinessEmailDetails } from "./find-business-email-details.js";
import { readAgencyBookingKey } from "./read-agency-booking-key.js";
import { resolveBusinessSender } from "./resolve-business-sender.js";

export type BookingEmailSetupType =
  | {
      ready: true;
      apiKey: string | null; // the agency's; null on the laptop, where nothing is sent
      senderEmail: string;
      notifyEmail: string;
      from: string; // "Primo Painters" <bookings@primopainters.com>
      fallbackFrom: string | null; // the agency's address, for when Resend refuses its own domain
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
  personWorkEmail: string | null; // the booked person's, read when the email goes
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
      language: booking.language,
      service: bookingLink.name,
      priceCents: bookingLink.priceCents,
      priceFrom: bookingLink.priceFrom,
      personName: resource.name,
      personWorkEmail: resource.workEmail,
      contactId: contact.id,
      customerName: contact.name,
      customerEmail: contact.email,
      phone: lead.phone, // the one given with this booking
      contactPhone: contact.phone,
      details: lead.details,
      answers: lead.answers,
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
    personWorkEmail: row.personWorkEmail,
  };
  // Notices go to its saved address, else its owner (feature 25a).
  const notifyEmail = business.notifyEmail ?? business.ownerEmail;
  const { timezone } = business;
  if (!notifyEmail || !timezone) {
    const missing = [!notifyEmail && "notification address", !timezone && "time zone"].filter(
      (what): what is string => Boolean(what)
    );
    return { ...context, setup: { ready: false, missing } };
  }
  const sender = await resolveBusinessSender({
    name: business.name,
    savedSender: business.senderEmail,
    website: business.website,
  });

  return {
    ...context,
    setup: {
      ready: true,
      apiKey: readAgencyBookingKey(),
      senderEmail: sender.senderEmail,
      notifyEmail,
      from: sender.from,
      fallbackFrom: sender.fallbackFrom,
      facts: {
        business: {
          name: business.name,
          logo: business.logo,
          phone: business.phone,
          website: business.website,
          brandColor: business.brandColor,
          brandInk: business.brandInk,
          timezone,
          language: business.language,
        },
        language: row.language,
        service: row.service,
        price: publicPriceOf(row.priceCents, row.priceFrom, business.currency),
        startsAt: row.startsAt,
        personName: row.personName,
        location: row.location,
        customer: {
          name: row.customerName,
          email: row.customerEmail,
          phone: row.phone ?? row.contactPhone,
          details: row.details,
          answers: (row.answers ?? []).map(({ question, answer }) => ({ question, answer })),
        },
      },
    },
  };
}
