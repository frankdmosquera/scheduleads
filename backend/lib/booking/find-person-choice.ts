// Backend: whether a customer may pick who does a service (feature 9, decision 3), read inside one
// business. Null when the service is missing, switched off or another business's.

import { and, eq } from "drizzle-orm";

import { bookingLink } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export async function findPersonChoice(
  organizationId: string,
  bookingLinkId: string
): Promise<"customer_picks" | "business_assigns" | null> {
  const [service] = await db
    .select({ personChoice: bookingLink.personChoice })
    .from(bookingLink)
    .where(
      and(
        eq(bookingLink.organizationId, organizationId),
        eq(bookingLink.id, bookingLinkId),
        eq(bookingLink.active, true)
      )
    )
    .limit(1);
  return service?.personChoice ?? null;
}
