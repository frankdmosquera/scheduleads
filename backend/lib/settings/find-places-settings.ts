// Backend: what the owner's Places page shows (feature 12k): every place of the business, on or
// off, the services that need each, the services to tick from, and the business's time zone for
// the bookings a turned-off place still holds.

import { and, asc, eq, isNull } from "drizzle-orm";

import { availabilityRule, bookingLink, resource } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { findPlaceServices } from "./find-place-services.js";
import {
  resourceSettingsColumns,
  resourceSettingsOf,
  type ResourceSettingsType,
} from "./resource-settings-of.js";

export async function findPlacesSettings(organizationId: string): Promise<{
  places: ResourceSettingsType[];
  timezone: string | null; // null until the business's hours are first saved
  services: { id: string; name: string; active: boolean }[]; // every service, to tick on a card
  placeServices: { placeId: string; serviceIds: string[] }[]; // one per place
}> {
  const [rows, [hours], services] = await Promise.all([
    db
      .select(resourceSettingsColumns)
      .from(resource)
      .where(and(eq(resource.organizationId, organizationId), eq(resource.kind, "place")))
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
    db
      .select({ id: bookingLink.id, name: bookingLink.name, active: bookingLink.active })
      .from(bookingLink)
      .where(eq(bookingLink.organizationId, organizationId))
      .orderBy(asc(bookingLink.name), asc(bookingLink.id)),
  ]);
  const placeServices = await findPlaceServices(
    db,
    organizationId,
    rows.map((row) => row.id)
  );
  return {
    places: rows.map(resourceSettingsOf),
    timezone: hours?.timezone ?? null,
    services,
    placeServices: rows.map((row) => ({
      placeId: row.id,
      serviceIds: placeServices.get(row.id)!,
    })),
  };
}
