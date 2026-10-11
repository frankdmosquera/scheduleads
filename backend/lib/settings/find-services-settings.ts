// Backend: what the owner's Services page shows: every service of the business, live or hidden,
// with who is ticked on each, every person and place to tick from, and the business's time zone for
// the bookings a new length lists.

import { and, asc, eq, isNull } from "drizzle-orm";

import { availabilityRule, bookingLink, resource } from "@scheduleads-app/shared/db";
import type { ServiceType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { findServiceTicks, type ServiceTicksType } from "./find-service-ticks.js";
import { resourceSettingsOf, type ResourceSettingsType } from "./resource-settings-of.js";

export type ServiceSettingsType = { id: string; slug: string } & ServiceType & ServiceTicksType;

// Who can be ticked: no work email, which only the People page shows.
const tickableColumns = {
  id: resource.id,
  name: resource.name,
  kind: resource.kind,
  active: resource.active,
};

// The columns the page shows and saves, so a read and a save answer the same shape.
export const serviceSettingsColumns = {
  id: bookingLink.id,
  slug: bookingLink.slug,
  name: bookingLink.name,
  description: bookingLink.description,
  durationMinutes: bookingLink.durationMinutes,
  bufferBeforeMinutes: bookingLink.bufferBeforeMinutes,
  bufferAfterMinutes: bookingLink.bufferAfterMinutes,
  slotIntervalMinutes: bookingLink.slotIntervalMinutes,
  personChoice: bookingLink.personChoice,
  asksAddress: bookingLink.asksAddress,
  active: bookingLink.active,
};

export async function findServicesSettings(organizationId: string): Promise<{
  services: ServiceSettingsType[];
  people: Omit<ResourceSettingsType, "workEmail">[];
  timezone: string | null; // null until the business's hours are first saved
}> {
  const [rows, people, [hours]] = await Promise.all([
    db
      .select(serviceSettingsColumns)
      .from(bookingLink)
      .where(eq(bookingLink.organizationId, organizationId))
      .orderBy(asc(bookingLink.name), asc(bookingLink.id)),
    db
      .select(tickableColumns)
      .from(resource)
      .where(eq(resource.organizationId, organizationId))
      .orderBy(asc(resource.name), asc(resource.id)),
    db
      .select({ timezone: availabilityRule.timezone })
      .from(availabilityRule)
      .where(
        and(
          eq(availabilityRule.organizationId, organizationId),
          isNull(availabilityRule.resourceId)
        )
      )
      .limit(1),
  ]);
  const ticks = await findServiceTicks(
    db,
    organizationId,
    rows.map((row) => row.id)
  );
  return {
    services: rows.map((row) => ({ ...row, ...ticks.get(row.id)! })),
    people: people.map(resourceSettingsOf),
    timezone: hours?.timezone ?? null,
  };
}
