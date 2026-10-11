// Backend: one person's worker-text settings (feature 8c), read inside their own business. Null when
// they have no row: no texts. On or off does not matter: they hear about the bookings they hold.

import { and, eq } from "drizzle-orm";

import { resource, workerTextSettings } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export type WorkerTextSettingsRowType = {
  phone: string; // as Twilio texts it, "+14035550161"
  addedOn: boolean;
  movedOn: boolean;
  removedOn: boolean;
};

export async function findWorkerTextSettings(
  organizationId: string,
  personId: string
): Promise<WorkerTextSettingsRowType | null> {
  const [row] = await db
    .select({
      phone: workerTextSettings.phone,
      addedOn: workerTextSettings.addedOn,
      movedOn: workerTextSettings.movedOn,
      removedOn: workerTextSettings.removedOn,
    })
    .from(workerTextSettings)
    .innerJoin(
      resource,
      and(
        eq(resource.organizationId, workerTextSettings.organizationId),
        eq(resource.id, workerTextSettings.personId)
      )
    )
    .where(
      and(
        eq(workerTextSettings.organizationId, organizationId),
        eq(workerTextSettings.personId, personId)
      )
    )
    .limit(1);
  return row ?? null;
}
