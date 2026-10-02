// Backend: puts one saved booking into the booked person's own calendar and keeps the event's id
// on the booking. With no calendar connected, or for a booking cancelled or already written, it
// writes nothing. Safe to call again: the event's id is made from the booking's, so Google keeps
// one event. Throws on any failure; the caller keeps the booking either way (decision 6).

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule, booking, bookingLink, contact, lead } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
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
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      location: booking.location,
      service: bookingLink.name,
      customer: contact.name,
      email: contact.email,
      phone: contact.phone,
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

  // Google takes an id of lowercase letters a to v and digits, so a booking's id without dashes fits.
  const id = bookingId.replace(/-/g, "").toLowerCase();
  if (!/^[a-v0-9]{5,1024}$/.test(id))
    throw new Error("Writing the event failed: the id does not fit Google.");

  const access = await getFreshAccessToken({ organizationId, resourceId: row.personId });
  if (!access) return null; // no calendar connected: nothing to write

  // What the worker needs on site (decision 14): who, where, how to reach them, what they wrote.
  const reach = [row.phone && `Phone: ${row.phone}`, row.email && `Email: ${row.email}`]
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

  await db
    .update(booking)
    .set({ calendarEventId: eventId })
    .where(and(eq(booking.organizationId, organizationId), eq(booking.id, bookingId)));
  return eventId;
}
