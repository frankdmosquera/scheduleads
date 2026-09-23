import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";

import { getPlanLimits, type Module, type PlanLimits } from "@scheduleads-app/shared/config";
import { organization } from "@scheduleads-app/shared/db";

import { db } from "../database.js";
import { refuse } from "./active-organization.js";

/**
 * The package gate: refuses a request whose business has not paid for the
 * part of the product it is reaching for.
 *
 * Mounted after `requireOrganization`, which resolves who is calling. This
 * only answers what they may reach.
 *
 * `organization.plan` is read here and nowhere else in the API. Every
 * decision about it goes through `getPlanLimits`, so an unrecognised value
 * fails closed in one place rather than being interpreted differently by
 * each caller.
 */

declare module "hono" {
  interface ContextVariableMap {
    plan: { rung: string; limits: PlanLimits };
  }
}

export const requireModule = (module: Module) =>
  createMiddleware(async (c, next) => {
    const org = c.get("org");

    if (!org) {
      throw new Error(
        "requireModule ran without requireOrganization before it. Mount them in that order."
      );
    }

    const [row] = await db
      .select({ plan: organization.plan })
      .from(organization)
      .where(eq(organization.id, org.organizationId))
      .limit(1);

    const rung = row?.plan ?? null;
    const limits = getPlanLimits(rung);

    if (!limits.modules.includes(module)) {
      return c.json(
        refuse(
          "plan_required",
          `This organization's plan does not include ${module}.`
        ),
        403
      );
    }

    c.set("plan", { rung: rung ?? "unknown", limits });
    await next();
  });
