// Backend: one business's text settings (feature 8b, decision 2), or null when it has none, which
// means it sends no texts. Read inside a booking's transaction when one is given.

import { eq } from "drizzle-orm";

import { textSettings } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import type { DatabaseExecutorType } from "../../database-executor-type.js";

export type TextSettingsRowType = typeof textSettings.$inferSelect;

export async function findTextSettings(
  organizationId: string,
  executor: DatabaseExecutorType = db
): Promise<TextSettingsRowType | null> {
  const [row] = await executor
    .select()
    .from(textSettings)
    .where(eq(textSettings.organizationId, organizationId))
    .limit(1);
  return row ?? null;
}
