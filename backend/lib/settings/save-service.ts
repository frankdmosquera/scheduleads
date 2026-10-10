// Backend: changes a service from the owner's Services page (feature 12d). Its slug and look stay
// as they are; hiding it stops new bookings and keeps every one already made.

import { and, eq } from "drizzle-orm";

import { bookingLink } from "@scheduleads-app/shared/db";
import type { ServiceType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { serviceSettingsColumns, type ServiceSettingsType } from "./find-services-settings.js";

// null: no such service in this business (another business's, or unknown).
export async function saveService(
  organizationId: string,
  serviceId: string,
  service: ServiceType
): Promise<ServiceSettingsType | null> {
  const [saved] = await db
    .update(bookingLink)
    .set(service)
    .where(and(eq(bookingLink.organizationId, organizationId), eq(bookingLink.id, serviceId)))
    .returning(serviceSettingsColumns);
  return saved ?? null;
}
