// Backend: the names of some people or places of one business, sorted by name then id, so two
// runs always list them alike. Used by booking a time and moving a booking to order their choices,
// and by a move's emails to name the move's own person.

import { and, asc, eq, inArray } from "drizzle-orm";

import { resource } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export async function findResourceNames(
  organizationId: string,
  ids: string[]
): Promise<{ resourceId: string; name: string }[]> {
  if (ids.length === 0) return [];
  return db
    .select({ resourceId: resource.id, name: resource.name })
    .from(resource)
    .where(and(eq(resource.organizationId, organizationId), inArray(resource.id, ids)))
    .orderBy(asc(resource.name), asc(resource.id));
}
