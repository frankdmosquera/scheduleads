// Backend: the services that need each place (feature 12k), read for the Places page and after a
// save. The same rows as each service's "Places it needs" on the Services page.

import { and, asc, eq, inArray } from "drizzle-orm";

import { bookingLinkResource } from "@scheduleads-app/shared/db";

import type { DatabaseExecutorType } from "../../database-executor-type.js";

export async function findPlaceServices(
  executor: DatabaseExecutorType,
  organizationId: string,
  placeIds: string[]
): Promise<Map<string, string[]>> {
  const services = new Map<string, string[]>(placeIds.map((id) => [id, []]));
  if (!placeIds.length) return services;
  const rows = await executor
    .select({
      placeId: bookingLinkResource.resourceId,
      serviceId: bookingLinkResource.bookingLinkId,
    })
    .from(bookingLinkResource)
    .where(
      and(
        eq(bookingLinkResource.organizationId, organizationId),
        inArray(bookingLinkResource.resourceId, placeIds)
      )
    )
    .orderBy(asc(bookingLinkResource.bookingLinkId));
  for (const row of rows) services.get(row.placeId)!.push(row.serviceId);
  return services;
}
