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
import { refuse } from "../../lib/refusal/refuse.js";

// Adds `subscription` and `organizationDetails` to Hono's context. Only the resolved tier
// and limits go on it, never the raw plan string.
declare module "hono" {
  interface ContextVariableMap {
    subscription: { tier: TierType; limits: SubscriptionLimitsType };
    organizationDetails: { name: string; slug: string };
  }
}

// The only place in the API that reads organization.plan, so an unknown value is
// handled one way, in one place.
export const requireKnownSubscriptionMiddleware = createMiddleware(async (c, next) => {
  const org = c.get("org");

  if (!org) {
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
    .where(eq(organization.id, org.organizationId))
    .limit(1);

  // The business was deleted since sign-in. Not a plan problem, so it gets the
  // "no business" answer rather than a misleading plan refusal.
  if (!row) {
    return c.json(
      refuse(
        "no_active_organization",
        "Choose which business you are working in before continuing."
      ),
      403
    );
  }

  // 403 plan_unrecognised: the business is on a tier the config does not define.
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
