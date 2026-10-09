// Backend: the sentence the booking form's box shows for a yes to later texts (feature 9, decision
// 13), with the business's name, or null when the business does not ask. Written here only, so the
// form shows it and the booking saves it word for word: what was saved is what she saw.

import { and, eq } from "drizzle-orm";

import { organization, textSettings } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import type { DatabaseExecutorType } from "../../database-executor-type.js";

export async function findLaterTextsYesWords(
  organizationId: string,
  executor: DatabaseExecutorType = db
): Promise<string | null> {
  // A business with no text settings sends no texts, so it never asks.
  const [asking] = await executor
    .select({ name: organization.name })
    .from(textSettings)
    .innerJoin(organization, eq(organization.id, textSettings.organizationId))
    .where(
      and(eq(textSettings.organizationId, organizationId), eq(textSettings.askLaterTextsYes, true))
    )
    .limit(1);
  return asking ? `Yes, ${asking.name} may text me offers and reminders to book again.` : null;
}
