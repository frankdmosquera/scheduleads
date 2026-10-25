// Backend: the services that need a place, from its card on the Places page (feature 12k): the
// ticked services replace the ones before, all at once. They are the rows the Services page ticks
// as "Places it needs", so either page changes the same thing.

import { and, asc, eq, inArray } from "drizzle-orm";

import { bookingLink, bookingLinkResource, resource } from "@scheduleads-app/shared/db";
import type { SavePlaceServicesType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { findPlaceServices } from "./find-place-services.js";

export type SavePlaceServicesResultType =
  | { ok: true; serviceIds: string[] }
  | { ok: false; reason: "not_found" | "not_a_place" | "bad_service" };

export async function savePlaceServices(
  organizationId: string,
  placeId: string,
  { serviceIds }: SavePlaceServicesType
): Promise<SavePlaceServicesResultType> {
  return db.transaction(async (tx) => {
    const [place] = await tx
      .select({ kind: resource.kind })
      .from(resource)
      .where(and(eq(resource.organizationId, organizationId), eq(resource.id, placeId)))
      // Not "update": the Services page's save takes a key share on this row while holding the
      // service, and would wait on us while we wait on the service.
      .for("no key update");
    if (!place) return { ok: false, reason: "not_found" } as const;
    if (place.kind !== "place") return { ok: false, reason: "not_a_place" } as const;

    const before = (await findPlaceServices(tx, organizationId, [placeId])).get(placeId)!;
    const added = serviceIds.filter((id) => !before.includes(id));
    const removed = before.filter((id) => !serviceIds.includes(id));
    const changed = [...added, ...removed].sort();
    // Every service must be this business's. Locked in one order, as the Services page's own save
    // locks each one, so the two never cross.
    const services = changed.length
      ? await tx
          .select({ id: bookingLink.id })
          .from(bookingLink)
          .where(
            and(eq(bookingLink.organizationId, organizationId), inArray(bookingLink.id, changed))
          )
          .orderBy(asc(bookingLink.id))
          .for("update")
      : [];
    if (services.length !== changed.length) return { ok: false, reason: "bad_service" } as const;

    if (removed.length) {
      await tx
        .delete(bookingLinkResource)
        .where(
          and(
            eq(bookingLinkResource.organizationId, organizationId),
            eq(bookingLinkResource.resourceId, placeId),
            inArray(bookingLinkResource.bookingLinkId, removed)
          )
        );
    }
    if (added.length) {
      await tx
        .insert(bookingLinkResource)
        .values(
          added.map((bookingLinkId) => ({ organizationId, bookingLinkId, resourceId: placeId }))
        )
        // The Services page may have ticked it between our read and the lock.
        .onConflictDoNothing();
    }
    return {
      ok: true,
      serviceIds: (await findPlaceServices(tx, organizationId, [placeId])).get(placeId)!,
    } as const;
  });
}
