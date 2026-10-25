// Backend: what a person can do, from their card on the People page (feature 12k): the ticked
// services replace the ones before, all at once. A newly ticked service turns them on for it; an
// unticked one turns them off, so nobody is ever on for a service they cannot do.

import { and, asc, eq, inArray } from "drizzle-orm";

import {
  bookingLink,
  bookingLinkResource,
  personSkill,
  resource,
} from "@scheduleads-app/shared/db";
import type { SavePersonSkillsType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { findPersonSkills, type PersonSkillsType } from "./find-person-skills.js";

export type SavePersonSkillsResultType =
  | { ok: true; skills: PersonSkillsType; nobodyOn: string[] } // names of services left with nobody on
  | { ok: false; reason: "not_found" | "not_a_person" | "bad_service" };

export async function savePersonSkills(
  organizationId: string,
  personId: string,
  { serviceIds }: SavePersonSkillsType
): Promise<SavePersonSkillsResultType> {
  return db.transaction(async (tx) => {
    const [person] = await tx
      .select({ kind: resource.kind })
      .from(resource)
      .where(and(eq(resource.organizationId, organizationId), eq(resource.id, personId)))
      // Not "update": a tick or a booking for them takes a key share on this row while holding
      // the service, and would wait on us while we wait on the service.
      .for("no key update");
    if (!person) return { ok: false, reason: "not_found" } as const;
    if (person.kind !== "person") return { ok: false, reason: "not_a_person" } as const;

    const before = await findPersonSkills(tx, organizationId, personId);
    const added = serviceIds.filter((id) => !before.serviceIds.includes(id));
    const removed = before.serviceIds.filter((id) => !serviceIds.includes(id));
    const changed = [...added, ...removed].sort();
    // Every service must be this business's. Locked in one order, as the Services page's own save
    // locks each one, so the two never cross.
    const services = changed.length
      ? await tx
          .select({ id: bookingLink.id, name: bookingLink.name })
          .from(bookingLink)
          .where(
            and(eq(bookingLink.organizationId, organizationId), inArray(bookingLink.id, changed))
          )
          .orderBy(asc(bookingLink.id))
          .for("update")
      : [];
    if (services.length !== changed.length) return { ok: false, reason: "bad_service" } as const;

    if (removed.length) {
      const leaving = and(
        eq(bookingLinkResource.organizationId, organizationId),
        eq(bookingLinkResource.resourceId, personId),
        inArray(bookingLinkResource.bookingLinkId, removed)
      );
      await tx.delete(bookingLinkResource).where(leaving);
      await tx
        .delete(personSkill)
        .where(
          and(
            eq(personSkill.organizationId, organizationId),
            eq(personSkill.resourceId, personId),
            inArray(personSkill.bookingLinkId, removed)
          )
        );
    }
    if (added.length) {
      await tx
        .insert(personSkill)
        .values(
          added.map((bookingLinkId) => ({ organizationId, resourceId: personId, bookingLinkId }))
        );
      await tx
        .insert(bookingLinkResource)
        .values(
          added.map((bookingLinkId) => ({ organizationId, bookingLinkId, resourceId: personId }))
        )
        .onConflictDoNothing();
    }

    // A service this person left with nobody on can no longer be booked: the owner is told.
    const stillOn = removed.length
      ? await tx
          .select({ id: bookingLinkResource.bookingLinkId })
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
              inArray(bookingLinkResource.bookingLinkId, removed),
              eq(resource.kind, "person"),
              eq(resource.active, true)
            )
          )
      : [];
    const nobodyOn = services
      .filter((service) => removed.includes(service.id))
      .filter((service) => !stillOn.some((row) => row.id === service.id))
      .map((service) => service.name)
      .sort((a, b) => a.localeCompare(b));

    return {
      ok: true,
      skills: await findPersonSkills(tx, organizationId, personId),
      nobodyOn,
    } as const;
  });
}
