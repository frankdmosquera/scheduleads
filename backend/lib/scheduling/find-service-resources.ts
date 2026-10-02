// Backend: who may be offered for a service, read by the free-time check (5c). The ticked people
// who are active, or every active person when nobody is ticked; the ticked places that are active,
// or no room check when no place is ticked. Ticked but all inactive means nobody, never anyone.

import { and, asc, eq } from "drizzle-orm";

import { bookingLink, bookingLinkResource, resource } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";

export type ServiceResourcesType = {
  peopleIds: string[];
  placeIds: string[] | null; // null: no room check; empty: a room is needed and none can be used
};

export async function findServiceResources(
  organizationId: string,
  bookingLinkId: string
): Promise<ServiceResourcesType | null> {
  try {
    const [service] = await db
      .select({ id: bookingLink.id })
      .from(bookingLink)
      .where(
        and(
          eq(bookingLink.organizationId, organizationId),
          eq(bookingLink.id, bookingLinkId),
          eq(bookingLink.active, true)
        )
      )
      .limit(1);
    if (!service) return null; // missing, inactive, or another business's

    const ticked = await db
      .select({ id: resource.id, kind: resource.kind, active: resource.active })
      .from(bookingLinkResource)
      .innerJoin(
        resource,
        and(
          eq(resource.organizationId, bookingLinkResource.organizationId),
          eq(resource.id, bookingLinkResource.resourceId)
        )
      )
      .where(
        and(
          eq(bookingLinkResource.organizationId, organizationId),
          eq(bookingLinkResource.bookingLinkId, bookingLinkId)
        )
      )
      .orderBy(asc(resource.name), asc(resource.id));

    const tickedPeople = ticked.filter((row) => row.kind === "person");
    const tickedPlaces = ticked.filter((row) => row.kind === "place");
    const activeIds = (rows: typeof ticked) =>
      rows.filter((row) => row.active).map((row) => row.id);

    const peopleIds = tickedPeople.length
      ? activeIds(tickedPeople)
      : (
          await db
            .select({ id: resource.id })
            .from(resource)
            .where(
              and(
                eq(resource.organizationId, organizationId),
                eq(resource.kind, "person"),
                eq(resource.active, true)
              )
            )
            .orderBy(asc(resource.name), asc(resource.id))
        ).map((row) => row.id);

    return { peopleIds, placeIds: tickedPlaces.length ? activeIds(tickedPlaces) : null };
  } catch (error) {
    throw new Error(`Reading who does what failed: ${safeErrorReason(error)}`);
  }
}
