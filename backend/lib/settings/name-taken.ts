// Backend: whether another person or place of the business already has this name, ignoring case
// and spaces at the ends (decision 6): two rows the owner cannot tell apart, and a setup file
// that would match the wrong one. Called inside a save's transaction, after it locked the business.

import { and, eq, ne, sql } from "drizzle-orm";

import { resource } from "@scheduleads-app/shared/db";

import type { DatabaseExecutorType } from "../../database-executor-type.js";

export async function nameTaken(
  executor: DatabaseExecutorType,
  organizationId: string,
  name: string,
  exceptId: string | null // the one being renamed, which may keep its own name
): Promise<boolean> {
  const [other] = await executor
    .select({ id: resource.id })
    .from(resource)
    .where(
      and(
        eq(resource.organizationId, organizationId),
        sql`lower(btrim(${resource.name})) = ${name.trim().toLowerCase()}`,
        exceptId ? ne(resource.id, exceptId) : undefined
      )
    )
    .limit(1);
  return Boolean(other);
}
