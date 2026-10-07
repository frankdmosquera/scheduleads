// Backend: the name of whoever texted a business, when their number is on one of its leads or
// contacts (feature 8b), so the business reads "Jane Doe" rather than a bare number. Phones are
// stored as typed, so both sides are compared by their last ten digits. The newest lead wins.

import { and, desc, eq, or, sql } from "drizzle-orm";

import { contact, lead } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

const tenDigits = (column: typeof lead.phone | typeof contact.phone) =>
  sql`right(regexp_replace(${column}, '[^0-9]', '', 'g'), 10)`;

// `number` is as Twilio gives it, "+14035550148".
export async function findReplySenderName(
  organizationId: string,
  number: string
): Promise<string | null> {
  const digits = number.replace(/\D/g, "").slice(-10);
  const [row] = await db
    .select({ name: contact.name })
    .from(lead)
    .innerJoin(
      contact,
      and(eq(contact.organizationId, lead.organizationId), eq(contact.id, lead.contactId))
    )
    .where(
      and(
        eq(lead.organizationId, organizationId),
        or(sql`${tenDigits(lead.phone)} = ${digits}`, sql`${tenDigits(contact.phone)} = ${digits}`)
      )
    )
    .orderBy(desc(lead.createdAt))
    .limit(1);
  return row?.name ?? null;
}
