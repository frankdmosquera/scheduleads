// Backend: makes the business's people and places change one save at a time, so two saves cannot
// both find a name free, or both find another person still on, and then both write. Locks the
// business's own row in the transaction; "no key update" still lets bookings and every other row
// that points at the business be written meanwhile.

import { eq } from "drizzle-orm";

import { organization } from "@scheduleads-app/shared/db";

import type { DatabaseExecutorType } from "../../database-executor-type.js";

export async function lockBusinessResources(
  executor: DatabaseExecutorType,
  organizationId: string
): Promise<void> {
  await executor
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .for("no key update");
}
