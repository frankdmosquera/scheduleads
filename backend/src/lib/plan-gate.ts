import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";

import {
  getPlanLimits,
  isKnownRung,
  type Module,
  type PlanLimits,
  type Rung,
} from "@scheduleads-app/shared/config";
import { organization } from "@scheduleads-app/shared/db";

import { db } from "../database.js";
import { refuse } from "./active-organization.js";

/**
 * The package gate, in two layers.
 *
 * `requireKnownPlan` asks whether the business is on a rung the config
 * defines at all. `requireModule` then asks whether that rung includes the
 * part of the product being reached for.
 *
 * They were one check until 2026-09-23, and merging them hid a real
 * difference. `/me` asked for `crm` while every comment around it, and the
 * dashboard's own refusal screen, said it refused only an unrecognised
 * plan. With one rung carrying both modules the two rules happened to
 * agree. The first booking-only rung would have locked that business out of
 * the whole dashboard and told it, falsely, that its plan was unrecognised.
 *
 * Mount order: `requireOrganization`, then `requireKnownPlan`, then any
 * `requireModule`. The dashboard's front door mounts the first two; a
 * module route mounts all three. Each throws if the one before it is
 * missing, so a wrong order fails at the first request, not silently.
 *
 * `organization.plan` is read here and nowhere else in the API. Every
 * decision about it goes through `plan-limits.ts`, so an unrecognised value
 * fails closed in one place rather than being interpreted differently by
 * each caller.
 *
 * `requireKnownPlan` also carries the organization's name and slug on to
 * the context. It is reading that row anyway, and `/me` used to read the
 * same row a second time to get them. The raw plan string is deliberately
 * not among what it hands on: only the resolved rung and limits leave here.
 */

declare module "hono" {
  interface ContextVariableMap {
    plan: { rung: Rung; limits: PlanLimits };
    organizationDetails: { name: string; slug: string };
  }
}

export const requireKnownPlan = createMiddleware(async (c, next) => {
  const org = c.get("org");

  if (!org) {
    throw new Error(
      "requireKnownPlan ran without requireOrganization before it. Mount them in that order."
    );
  }

  const [row] = await db
    .select({
      plan: organization.plan,
      name: organization.name,
      slug: organization.slug,
    })
    .from(organization)
    .where(eq(organization.id, org.organizationId))
    .limit(1);

  // The session points at a business that is no longer there. That is not a
  // plan problem, and answering with a plan refusal would tell the user the
  // wrong thing, so it gets the same answer as having no business at all.
  if (!row) {
    return c.json(
      refuse(
        "no_active_organization",
        "Choose which business you are working in before continuing."
      ),
      403
    );
  }

  if (!isKnownRung(row.plan)) {
    return c.json(
      refuse(
        "plan_unrecognised",
        "This business is on a plan the product does not recognise."
      ),
      403
    );
  }

  c.set("plan", { rung: row.plan, limits: getPlanLimits(row.plan) });
  c.set("organizationDetails", { name: row.name, slug: row.slug });
  await next();
});

/**
 * Narrows to one module within an already-recognised rung. Reads what
 * `requireKnownPlan` put on the context, so it costs no query of its own.
 */
export const requireModule = (module: Module) =>
  createMiddleware(async (c, next) => {
    const plan = c.get("plan");

    if (!plan) {
      throw new Error(
        "requireModule ran without requireKnownPlan before it. Mount them in that order."
      );
    }

    if (!plan.limits.modules.includes(module)) {
      return c.json(
        refuse(
          "plan_required",
          `This organization's plan does not include ${module}.`
        ),
        403
      );
    }

    await next();
  });
