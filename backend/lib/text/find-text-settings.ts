// Backend: one business's text settings (feature 8b, decision 2), or null when it has none, which
// means it sends no texts.

import { eq } from "drizzle-orm";

import { textSettings } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export type TextSettingsRowType = typeof textSettings.$inferSelect;

export async function findTextSettings(
  organizationId: string
): Promise<TextSettingsRowType | null> {
  const [row] = await db
    .select()
    .from(textSettings)
    .where(eq(textSettings.organizationId, organizationId))
    .limit(1);
  return row ?? null;
}
