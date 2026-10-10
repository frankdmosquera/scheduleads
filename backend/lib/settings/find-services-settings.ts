// Backend: what the owner's Services page shows: every service of the business, live or hidden.

import { asc, eq } from "drizzle-orm";

import { bookingLink } from "@scheduleads-app/shared/db";
import type { ServiceType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";

export type ServiceSettingsType = { id: string; slug: string } & ServiceType;

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

export async function findServicesSettings(organizationId: string): Promise<ServiceSettingsType[]> {
  return db
    .select(serviceSettingsColumns)
    .from(bookingLink)
    .where(eq(bookingLink.organizationId, organizationId))
    .orderBy(asc(bookingLink.name), asc(bookingLink.id));
}
