// Backend: who may be offered for a service, read by the free-time check (5c). The people on for it
// who can do it and are active (feature 12k: nobody on means nobody, never anyone); the ticked
// places that are active, or no room check when no place is ticked.

import { and, asc, eq } from "drizzle-orm";

import {
  bookingLink,
  bookingLinkResource,
  personSkill,
  resource,
} from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";

export type ServiceResourcesType = {
  peopleIds: string[];
  placeIds: string[] | null; // null: no room check; empty: a room is needed and none can be used
};

// serviceMayBeOff: an existing booking's own service is read even when switched off, since that
// stops only new bookings (feature 7b, decision 13).
export async function findServiceResources(
  organizationId: string,
  bookingLinkId: string,
  { serviceMayBeOff = false }: { serviceMayBeOff?: boolean } = {}
): Promise<ServiceResourcesType | null> {
  try {
    const [service] = await db
      .select({ id: bookingLink.id })
      .from(bookingLink)
      .where(
        and(
          eq(bookingLink.organizationId, organizationId),
          eq(bookingLink.id, bookingLinkId),
          serviceMayBeOff ? undefined : eq(bookingLink.active, true)
        )
      )
      .limit(1);
    if (!service) return null; // missing, inactive, or another business's

    const ticked = await db
      .select({
        id: resource.id,
        kind: resource.kind,
        active: resource.active,
        canDo: personSkill.resourceId, // null for a place, and for a person without the skill
      })
      .from(bookingLinkResource)
      .innerJoin(
        resource,
        and(
          eq(resource.organizationId, bookingLinkResource.organizationId),
          eq(resource.id, bookingLinkResource.resourceId)
        )
      )
      .leftJoin(
        personSkill,
        and(
          eq(personSkill.organizationId, bookingLinkResource.organizationId),
          eq(personSkill.resourceId, bookingLinkResource.resourceId),
          eq(personSkill.bookingLinkId, bookingLinkResource.bookingLinkId)
        )
      )
      .where(
        and(
          eq(bookingLinkResource.organizationId, organizationId),
          eq(bookingLinkResource.bookingLinkId, bookingLinkId)
        )
      )
      .orderBy(asc(resource.name), asc(resource.id));

    const peopleIds = ticked
      .filter((row) => row.kind === "person" && row.active && row.canDo !== null)
      .map((row) => row.id);
    const tickedPlaces = ticked.filter((row) => row.kind === "place");
    const placeIds = tickedPlaces.length
      ? tickedPlaces.filter((row) => row.active).map((row) => row.id)
      : null;
    return { peopleIds, placeIds };
  } catch (error) {
    throw new Error(`Reading who does what failed: ${safeErrorReason(error)}`);
  }
}
