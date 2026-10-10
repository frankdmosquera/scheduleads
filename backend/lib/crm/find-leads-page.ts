// Backend: the owner's leads list, one page at a time, newest first. Read inside one business
// only; the next page starts after a lead of that same business, or there is no page at all.

import { and, desc, eq, sql } from "drizzle-orm";

import { contact, lead, pipelineStage } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { findBusinessTimeZone } from "./find-business-time-zone.js";
import { findNewestBookings } from "./find-newest-bookings.js";
import { leadWhat } from "./lead-what.js";

const PAGE_SIZE = 50;

export type LeadSourceType = "widget" | "hosted" | "manual";

export type LeadsListRowType = {
  id: string;
  createdAt: string;
  source: LeadSourceType;
  stage: { id: string; name: string };
  contact: { id: string; name: string; phone: string | null; email: string | null };
  what: string | null;
  booking: { startsAt: string; status: "confirmed" | "cancelled" } | null;
};

export type LeadsPageType = {
  leads: LeadsListRowType[];
  nextAfter: string | null;
  timeZone: string | null;
};

// Null when `after` is not one of this business's leads.
export async function findLeadsPage(
  organizationId: string,
  after: string | null
): Promise<LeadsPageType | null> {
  if (after) {
    const [known] = await db
      .select({ id: lead.id })
      .from(lead)
      .where(and(eq(lead.organizationId, organizationId), eq(lead.id, after)))
      .limit(1);
    if (!known) return null;
  }

  const rows = await db
    .select({
      id: lead.id,
      createdAt: lead.createdAt,
      source: lead.source,
      details: lead.details,
      leadPhone: lead.phone,
      stageId: pipelineStage.id,
      stageName: pipelineStage.name,
      contactId: contact.id,
      contactName: contact.name,
      contactPhone: contact.phone,
      contactEmail: contact.email,
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
    .where(
      and(
        eq(lead.organizationId, organizationId),
        // Compared in the database, so createdAt keeps its microseconds: a JS Date would round them.
        after
          ? sql`(${lead.createdAt}, ${lead.id}) < (select "createdAt", "id" from "lead" where "organizationId" = ${organizationId} and "id" = ${after})`
          : undefined
      )
    )
    .orderBy(desc(lead.createdAt), desc(lead.id))
    .limit(PAGE_SIZE + 1);

  const page = rows.slice(0, PAGE_SIZE);
  const [bookings, timeZone] = await Promise.all([
    findNewestBookings(
      organizationId,
      page.map((row) => row.id)
    ),
    findBusinessTimeZone(organizationId),
  ]);

  return {
    leads: page.map((row) => {
      const newest = bookings.get(row.id) ?? null;
      return {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        source: row.source as LeadSourceType, // the table's check allows only these three
        stage: { id: row.stageId, name: row.stageName },
        contact: {
          id: row.contactId,
          name: row.contactName,
          phone: row.leadPhone ?? row.contactPhone,
          email: row.contactEmail,
        },
        what: leadWhat(newest?.serviceName ?? null, row.details),
        booking: newest ? { startsAt: newest.startsAt.toISOString(), status: newest.status } : null,
      };
    }),
    nextAfter: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
    timeZone,
  };
}
