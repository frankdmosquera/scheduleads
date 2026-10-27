// Backend: the Services page's "Prices in" (feature 25d): the one currency the business's prices
// are in. Null takes it off, which hides every price and keeps them.

import { eq } from "drizzle-orm";

import { organization } from "@scheduleads-app/shared/db";
import type { SaveCurrencyType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";

export async function saveServicesCurrency(
  organizationId: string,
  { currency }: SaveCurrencyType
): Promise<SaveCurrencyType> {
  const [saved] = await db
    .update(organization)
    .set({ currency })
    .where(eq(organization.id, organizationId))
    .returning({ currency: organization.currency });
  return { currency: saved.currency };
}
