// Backend: who is ticked on each service, as the Services page shows it (feature 12d): people and
// places, on or off, so a turned-off tick still shows, and who can do it (feature 12k), so who may be
// on. The booking side reads the same rows through findServiceResources, which offers only the
// ones on.

import { and, asc, eq, inArray } from "drizzle-orm";

import { bookingLinkResource, personSkill, resource } from "@scheduleads-app/shared/db";

import type { DatabaseExecutorType } from "../../database-executor-type.js";

export type ServiceTicksType = { peopleIds: string[]; placeIds: string[]; ablePeopleIds: string[] };

export async function findServiceTicks(
  executor: DatabaseExecutorType,
  organizationId: string,
  serviceIds: string[]
): Promise<Map<string, ServiceTicksType>> {
  const ticks = new Map<string, ServiceTicksType>(
    serviceIds.map((id) => [id, { peopleIds: [], placeIds: [], ablePeopleIds: [] }])
  );
  if (!serviceIds.length) return ticks;
  const rows = await executor
    .select({
      serviceId: bookingLinkResource.bookingLinkId,
      resourceId: resource.id,
      kind: resource.kind,
    })
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
        inArray(bookingLinkResource.bookingLinkId, serviceIds)
      )
    )
    .orderBy(asc(resource.name), asc(resource.id));
  for (const row of rows) {
    const service = ticks.get(row.serviceId)!;
    (row.kind === "place" ? service.placeIds : service.peopleIds).push(row.resourceId);
  }
  const able = await executor
    .select({ serviceId: personSkill.bookingLinkId, personId: personSkill.resourceId })
    .from(personSkill)
    .innerJoin(
      resource,
      and(
        eq(resource.organizationId, personSkill.organizationId),
        eq(resource.id, personSkill.resourceId)
      )
    )
    .where(
      and(
        eq(personSkill.organizationId, organizationId),
        inArray(personSkill.bookingLinkId, serviceIds)
      )
    )
    .orderBy(asc(resource.name), asc(resource.id));
  for (const row of able) ticks.get(row.serviceId)!.ablePeopleIds.push(row.personId);
  return ticks;
}
