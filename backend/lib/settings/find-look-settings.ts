// Backend: what the owner's Look page shows (feature 25e): the business's name and its logo.

import { eq } from "drizzle-orm";

import { organization } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export async function findLookSettings(
  organizationId: string
): Promise<{ name: string; logo: string | null }> {
  const [row] = await db
    .select({ name: organization.name, logo: organization.logo })
    .from(organization)
    .where(eq(organization.id, organizationId));
  return { name: row?.name ?? "", logo: row?.logo ?? null };
}
