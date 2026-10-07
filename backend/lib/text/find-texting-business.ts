// Backend: the business that texts from a number, or null when none does (feature 8b). A reply is
// told apart by the number it was sent to, which is why each number belongs to one business.

import { eq } from "drizzle-orm";

import { textSettings } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export async function findTextingBusiness(number: string): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: textSettings.organizationId })
    .from(textSettings)
    .where(eq(textSettings.fromNumber, number))
    .limit(1);
  return row?.organizationId ?? null;
}
