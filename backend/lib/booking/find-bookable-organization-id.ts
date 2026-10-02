// Backend: the business behind a public booking address, when it can be booked: its plan includes
// booking and it has bookable hours. The only place a public route takes a business from the URL;
// every query after uses this id. The plan is also read in requireKnownSubscriptionMiddleware: a
// change to plans touches both.

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule, organization } from "@scheduleads-app/shared/db";
import { subscriptionIncludes } from "@scheduleads-app/shared/subscriptions";

import { db } from "../../database.js";

export async function findBookableOrganizationId(slug: string): Promise<string | null> {
  const [row] = await db
    .select({ id: organization.id, plan: organization.plan, hoursId: availabilityRule.id })
    .from(organization)
    .leftJoin(
      availabilityRule,
      and(eq(availabilityRule.organizationId, organization.id), isNull(availabilityRule.resourceId))
    )
    .where(eq(organization.slug, slug))
    .limit(1);

  if (!row || !subscriptionIncludes(row.plan, "booking") || row.hoursId === null) return null;
  return row.id;
}
