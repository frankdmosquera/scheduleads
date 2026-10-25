// Backend: who does a service, from the owner's Services page (feature 12d): the people on for it
// and the places it needs replace the ones before, all at once. A person is on only if they can do
// it (feature 12k). A turned-off one may stay on; the booking side never offers it.

import { and, eq, inArray } from "drizzle-orm";

import {
  bookingLink,
  bookingLinkResource,
  personSkill,
  resource,
} from "@scheduleads-app/shared/db";
import type { SaveServiceResourcesType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { findServiceTicks, type ServiceTicksType } from "./find-service-ticks.js";

export type SaveServiceResourcesResultType =
  | { ok: true; ticks: ServiceTicksType }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "bad_tick"; field: "peopleIds" | "placeIds"; message: string };

export async function saveServiceResources(
  organizationId: string,
  serviceId: string,
  ticks: SaveServiceResourcesType
): Promise<SaveServiceResourcesResultType> {
  return db.transaction(async (tx) => {
    // Locks the service, so two saves of its ticks run one after the other and the last one wins.
    const [service] = await tx
      .select({ id: bookingLink.id })
      .from(bookingLink)
      .where(and(eq(bookingLink.organizationId, organizationId), eq(bookingLink.id, serviceId)))
      .for("update");
    if (!service) return { ok: false, reason: "not_found" } as const;

    // Every id must be this business's, and of the kind its list says.
    const ids = [...ticks.peopleIds, ...ticks.placeIds];
    const found = ids.length
      ? await tx
          .select({ id: resource.id, kind: resource.kind, name: resource.name })
          .from(resource)
          .where(and(eq(resource.organizationId, organizationId), inArray(resource.id, ids)))
      : [];
    const kindOf = new Map(found.map((row) => [row.id, row.kind]));
    if (ticks.peopleIds.some((id) => kindOf.get(id) !== "person")) {
      return {
        ok: false,
        reason: "bad_tick",
        field: "peopleIds",
        message: "Tick only this business's people.",
      } as const;
    }
    // On only while they can do it: the skill is ticked on their card, never here.
    const able = new Set(
      (
        await tx
          .select({ id: personSkill.resourceId })
          .from(personSkill)
          .where(
            and(
              eq(personSkill.organizationId, organizationId),
              eq(personSkill.bookingLinkId, serviceId)
            )
          )
      ).map((row) => row.id)
    );
    const unable = ticks.peopleIds.find((id) => !able.has(id));
    if (unable) {
      const name = found.find((row) => row.id === unable)!.name;
      return {
        ok: false,
        reason: "bad_tick",
        field: "peopleIds",
        message: `${name} cannot do this service yet: tick it on their card on People.`,
      } as const;
    }
    if (ticks.placeIds.some((id) => kindOf.get(id) !== "place")) {
      return {
        ok: false,
        reason: "bad_tick",
        field: "placeIds",
        message: "Tick only this business's places.",
      } as const;
    }

    await tx
      .delete(bookingLinkResource)
      .where(
        and(
          eq(bookingLinkResource.organizationId, organizationId),
          eq(bookingLinkResource.bookingLinkId, serviceId)
        )
      );
    if (ids.length) {
      await tx
        .insert(bookingLinkResource)
        .values(
          ids.map((resourceId) => ({ organizationId, bookingLinkId: serviceId, resourceId }))
        );
    }
    const saved = await findServiceTicks(tx, organizationId, [serviceId]);
    return { ok: true, ticks: saved.get(serviceId)! } as const;
  });
}
