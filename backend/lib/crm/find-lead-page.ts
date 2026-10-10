// Backend: one lead's page: the lead, the person behind it, its bookings, their other requests,
// their open next steps and their timeline. Everything read inside one business; a lead of
// another business is the same null as one that never existed.

import { and, asc, desc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  activity,
  booking,
  bookingLink,
  contact,
  lead,
  pipelineStage,
  resource,
  user,
} from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { findBusinessTimeZone } from "./find-business-time-zone.js";
import { type LeadSourceType } from "./find-leads-page.js";
import { findNewestBookings } from "./find-newest-bookings.js";
import { leadWhat } from "./lead-what.js";
import { timelineEntryOf, type TimelineEntryType } from "./timeline-entry-of.js";

const TIMELINE_LIMIT = 200;

const place = alias(resource, "place");

export type LeadPageType = {
  lead: {
    id: string;
    createdAt: string;
    source: LeadSourceType;
    stage: { id: string; name: string };
    phone: string | null;
    details: string | null;
    answers: { question: string; answer: string }[];
  };
  contact: { id: string; name: string; email: string | null; phone: string | null };
  bookings: {
    id: string;
    serviceName: string;
    startsAt: string;
    endsAt: string;
    status: "confirmed" | "cancelled";
    personName: string;
    placeName: string | null;
    location: string | null;
  }[];
  otherLeads: { id: string; createdAt: string; stageName: string; what: string | null }[];
  nextSteps: { id: string; type: string; dueAt: string; what: string | null }[];
  timeline: TimelineEntryType[];
  timelineCut: boolean;
  timeZone: string | null;
};

export async function findLeadPage(
  organizationId: string,
  leadId: string
): Promise<LeadPageType | null> {
  const [row] = await db
    .select({
      id: lead.id,
      createdAt: lead.createdAt,
      source: lead.source,
      phone: lead.phone,
      details: lead.details,
      answers: lead.answers,
      stageId: pipelineStage.id,
      stageName: pipelineStage.name,
      contactId: contact.id,
      contactName: contact.name,
      contactEmail: contact.email,
      contactPhone: contact.phone,
    })
    .from(lead)
    .innerJoin(
      contact,
      and(eq(contact.organizationId, lead.organizationId), eq(contact.id, lead.contactId))
    )
    .innerJoin(
      pipelineStage,
      and(eq(pipelineStage.organizationId, lead.organizationId), eq(pipelineStage.id, lead.stageId))
    )
    .where(and(eq(lead.organizationId, organizationId), eq(lead.id, leadId)))
    .limit(1);
  if (!row) return null;

  const [bookings, otherLeads, nextSteps, timelineRows, timeZone] = await Promise.all([
    db
      .select({
        id: booking.id,
        serviceName: bookingLink.name,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        status: booking.status,
        personName: resource.name,
        placeName: place.name,
        location: booking.location,
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
      .leftJoin(
        place,
        and(eq(place.organizationId, booking.organizationId), eq(place.id, booking.placeId))
      )
      .where(and(eq(booking.organizationId, organizationId), eq(booking.leadId, leadId)))
      .orderBy(desc(booking.createdAt), desc(booking.id)),

    db
      .select({
        id: lead.id,
        createdAt: lead.createdAt,
        details: lead.details,
        stageName: pipelineStage.name,
      })
      .from(lead)
      .innerJoin(
        pipelineStage,
        and(
          eq(pipelineStage.organizationId, lead.organizationId),
          eq(pipelineStage.id, lead.stageId)
        )
      )
      .where(
        and(
          eq(lead.organizationId, organizationId),
          eq(lead.contactId, row.contactId),
          ne(lead.id, leadId)
        )
      )
      .orderBy(desc(lead.createdAt), desc(lead.id)),

    db
      .select({
        id: activity.id,
        type: activity.type,
        dueAt: activity.dueAt,
        payload: activity.payload,
      })
      .from(activity)
      .where(
        and(
          eq(activity.organizationId, organizationId),
          eq(activity.contactId, row.contactId),
          isNotNull(activity.dueAt),
          isNull(activity.doneAt)
        )
      )
      .orderBy(asc(activity.dueAt), asc(activity.id)),

    db
      .select({
        id: activity.id,
        type: activity.type,
        payload: activity.payload,
        occurredAt: activity.occurredAt,
        actorName: user.name,
        actorEmail: user.email,
      })
      .from(activity)
      .leftJoin(user, eq(user.id, activity.actorUserId))
      .where(
        and(
          eq(activity.organizationId, organizationId),
          eq(activity.contactId, row.contactId),
          isNotNull(activity.occurredAt)
        )
      )
      .orderBy(desc(activity.occurredAt), desc(activity.id))
      .limit(TIMELINE_LIMIT + 1),

    findBusinessTimeZone(organizationId),
  ]);

  const otherBookings = await findNewestBookings(
    organizationId,
    otherLeads.map((other) => other.id)
  );

  const shownRows = timelineRows.slice(0, TIMELINE_LIMIT);
  const serviceNames = await findServiceNames(organizationId, bookingIdsOf(shownRows));

  return {
    lead: {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      source: row.source as LeadSourceType, // the table's check allows only these three
      stage: { id: row.stageId, name: row.stageName },
      phone: row.phone,
      details: row.details,
      answers: (row.answers ?? []).map(({ question, answer }) => ({ question, answer })),
    },
    contact: {
      id: row.contactId,
      name: row.contactName,
      email: row.contactEmail,
      phone: row.contactPhone,
    },
    bookings: bookings.map((one) => ({
      ...one,
      startsAt: one.startsAt.toISOString(),
      endsAt: one.endsAt.toISOString(),
      status: one.status === "cancelled" ? "cancelled" : "confirmed",
    })),
    otherLeads: otherLeads.map((other) => ({
      id: other.id,
      createdAt: other.createdAt.toISOString(),
      stageName: other.stageName,
      what: leadWhat(otherBookings.get(other.id)?.serviceName ?? null, other.details),
    })),
    nextSteps: nextSteps.map((step) => {
      const what = (step.payload as Record<string, unknown> | null)?.what;
      return {
        id: step.id,
        type: step.type,
        dueAt: step.dueAt!.toISOString(), // the query keeps only rows with a due date
        what: typeof what === "string" ? what : null,
      };
    }),
    timeline: shownRows.map((one) =>
      timelineEntryOf(
        {
          id: one.id,
          type: one.type,
          payload: one.payload,
          occurredAt: one.occurredAt!, // the query keeps only rows that happened
          actorName: one.actorName || one.actorEmail || null, // a login made by email code has no name
        },
        serviceNames
      )
    ),
    timelineCut: timelineRows.length > TIMELINE_LIMIT,
    timeZone,
  };
}

// The booking ids the timeline rows point at, each once.
function bookingIdsOf(rows: { payload: unknown }[]): string[] {
  const ids = rows
    .map((row) => (row.payload as Record<string, unknown> | null)?.bookingId)
    .filter((id): id is string => typeof id === "string");
  return [...new Set(ids)];
}

// Booking id to its service's name, inside one business.
async function findServiceNames(
  organizationId: string,
  bookingIds: string[]
): Promise<Map<string, string>> {
  if (bookingIds.length === 0) return new Map();
  const rows = await db
    .select({ id: booking.id, name: bookingLink.name })
    .from(booking)
    .innerJoin(
      bookingLink,
      and(
        eq(bookingLink.organizationId, booking.organizationId),
        eq(bookingLink.id, booking.bookingLinkId)
      )
    )
    .where(and(eq(booking.organizationId, organizationId), inArray(booking.id, bookingIds)));
  return new Map(rows.map((one) => [one.id, one.name]));
}
