// Is the business on a tier that exists at all? Always in this order:
// requireOrganizationMiddleware -> requireKnownSubscriptionMiddleware -> requireModuleMiddleware("...").

import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";

import {
  getSubscriptionLimits,
  isKnownTier,
  type SubscriptionLimitsType,
  type TierType,
} from "@scheduleads-app/shared/subscriptions";
import { organization } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { refuse } from "../../lib/errors/refuse.js";

// Adds `subscription` and `organizationDetails` to Hono's context. Only the resolved tier
// and limits go on it, never the raw plan string.
declare module "hono" {
  interface ContextVariableMap {
    subscription: { tier: TierType; limits: SubscriptionLimitsType };
    organizationDetails: { name: string; slug: string };
  }
}

// One of two places that read organization.plan; the other is routes/public-booking-links-routes.ts,
// which answers a plan without booking with its quiet 404 on purpose. A change to plans touches both.
export const requireKnownSubscriptionMiddleware = createMiddleware(async (c, next) => {
  const activeOrganization = c.get("organization");

  if (!activeOrganization) {
    throw new Error(
      "requireKnownSubscriptionMiddleware ran without requireOrganizationMiddleware before it. Mount them in that order."
    );
  }

  // Name and slug come along because this row is read anyway: /me needs no second query.
  const [row] = await db
    .select({
      plan: organization.plan,
      name: organization.name,
      slug: organization.slug,
    })
    .from(organization)
    .where(eq(organization.id, activeOrganization.organizationId))
    .limit(1);

  // Deleted since sign-in: a "no business" answer, not a misleading plan refusal.
  if (!row) {
    return c.json(
      refuse(
        "no_active_organization",
        "Choose which business you are working in before continuing."
      ),
      403
    );
  }

  if (!isKnownTier(row.plan)) {
    return c.json(
      refuse("plan_unrecognised", "This business is on a plan the product does not recognise."),
      403
    );
  }

  c.set("subscription", { tier: row.plan, limits: getSubscriptionLimits(row.plan) });
  c.set("organizationDetails", { name: row.name, slug: row.slug });
  await next();
});
