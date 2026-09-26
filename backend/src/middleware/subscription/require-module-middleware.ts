// Does the business's tier include this module? Mounted after requireKnownSubscriptionMiddleware.

import { createMiddleware } from "hono/factory";

import { type ModuleType } from "@scheduleads-app/shared/subscriptions";

import { refuse } from "../../lib/refusal/refuse.js";

// A function that makes a middleware: requireModuleMiddleware("booking"). Reads what
// requireKnownSubscriptionMiddleware stored, so no query of its own.
export const requireModuleMiddleware = (module: ModuleType) =>
  createMiddleware(async (c, next) => {
    const subscription = c.get("subscription");

    if (!subscription) {
      throw new Error(
        "requireModuleMiddleware ran without requireKnownSubscriptionMiddleware before it. Mount them in that order."
      );
    }

    // 403 plan_required: a real tier, but it does not include this module.
    if (!subscription.limits.modules.includes(module)) {
      return c.json(
        refuse("plan_required", `This organization's plan does not include ${module}.`),
        403
      );
    }

    await next();
  });
