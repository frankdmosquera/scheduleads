// Backend: whether a service belongs to this business, asked before a photo is uploaded for it, so
// another business's service, or an unknown one, never costs an upload (feature 25e).

import { and, eq } from "drizzle-orm";

import { bookingLink } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export async function serviceExistsHere(
  organizationId: string,
  serviceId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: bookingLink.id })
    .from(bookingLink)
    .where(and(eq(bookingLink.organizationId, organizationId), eq(bookingLink.id, serviceId)))
    .limit(1);
  return !!row;
}
