// Backend: puts one saved booking into the booked person's own calendar and keeps the event's id
// on the booking. With no calendar connected, or for a booking cancelled or already written, it
// writes nothing. Safe to call again: the event's id is made from the booking's, so Google keeps
// one event. The id is saved only while the booking still has the person and the move number
// read here: a move or cancel landing during the call adds its own jobs, which take this event
// out. Throws on any failure; the booking is kept either way and its job tries again.

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule, booking, bookingLink, contact, lead } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { calendarEventIdOf } from "./calendar-event-id-of.js";
import { getFreshAccessToken } from "./get-fresh-access-token.js";

export async function writeBookingEvent(
  organizationId: string,
  bookingId: string
): Promise<string | null> {
  const [row] = await db
    .select({
      personId: booking.personId,
      status: booking.status,
      calendarEventId: booking.calendarEventId,
      sequence: booking.sequence,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      location: booking.location,
      service: bookingLink.name,
      customer: contact.name,
      email: contact.email,
      phone: lead.phone, // the one given with this booking (decision 15)
      contactPhone: contact.phone,
      details: lead.details,
      timezone: availabilityRule.timezone,
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
      lead,
      and(eq(lead.organizationId, booking.organizationId), eq(lead.id, booking.leadId))
    )
    .innerJoin(
      contact,
      and(eq(contact.organizationId, booking.organizationId), eq(contact.id, lead.contactId))
    )
    .innerJoin(
      availabilityRule,
      and(
        eq(availabilityRule.organizationId, booking.organizationId),
        isNull(availabilityRule.resourceId)
      )
    )
    .where(and(eq(booking.organizationId, organizationId), eq(booking.id, bookingId)))
    .limit(1);
  if (!row) throw new Error("Writing the event failed: no such booking in this business.");
  if (!row.timezone) throw new Error("Writing the event failed: the business has no time zone.");
  if (row.status !== "confirmed") return null; // a cancelled booking has no event to write
  if (row.calendarEventId) return row.calendarEventId; // written already

  const id = calendarEventIdOf(bookingId, row.sequence); // fresh after a move, so never refused

  const access = await getFreshAccessToken({ organizationId, resourceId: row.personId });
  if (!access) return null; // no calendar connected: nothing to write

  // What the worker needs on site (decision 14): who, where, how to reach them, what they wrote.
  const phone = row.phone ?? row.contactPhone;
  const reach = [phone && `Phone: ${phone}`, row.email && `Email: ${row.email}`]
    .filter(Boolean)
    .join("\n");
  const eventId = await access.provider.createEvent(access.accessToken, {
    id,
    title: `${row.service}: ${row.customer}`,
    location: row.location,
    description: [reach, row.details].filter(Boolean).join("\n\n"),
    start: row.startsAt,
    end: row.endsAt, // the appointment itself, not its buffers
    timezone: row.timezone,
  });

  const saved = await db
    .update(booking)
    .set({ calendarEventId: eventId })
    .where(
      and(
        eq(booking.organizationId, organizationId),
        eq(booking.id, bookingId),
        eq(booking.personId, row.personId),
        eq(booking.sequence, row.sequence),
        eq(booking.status, "confirmed")
      )
    )
    .returning({ id: booking.id });
  return saved.length > 0 ? eventId : null; // null: the booking changed while Google wrote
}
