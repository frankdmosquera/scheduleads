// Backend: the owner's leads list and each lead's page. The business always comes from the session,
// never from the request; any member of the business whose plan includes the CRM may read them.

import { Hono } from "hono";
import { validator } from "hono/validator";

import { findLeadPage } from "../lib/crm/find-lead-page.js";
import { findLeadsPage } from "../lib/crm/find-leads-page.js";
import { refuse } from "../lib/errors/refuse.js";
import { requireOrganizationMiddleware } from "../middleware/auth-middleware/require-organization-middleware.js";
import { requireKnownSubscriptionMiddleware } from "../middleware/subscription-middleware/require-known-subscription-middleware.js";
import { requireModuleMiddleware } from "../middleware/subscription-middleware/require-module-middleware.js";

export const leadsRoutes = new Hono()
  // The list, newest first; `after` is the last lead of the page before.
  .get(
    "/",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("crm"),
    validator("query", (value, c) => {
      const after = value.after;
      if (after !== undefined && (typeof after !== "string" || after.length > 100)) {
        return c.json(refuse("bad_request", "That page of leads does not exist."), 400);
      }
      return { after: after || null };
    }),
    async (c) => {
      const page = await findLeadsPage(
        c.get("organization").organizationId,
        c.req.valid("query").after
      );
      if (!page) return c.json(refuse("bad_request", "That page of leads does not exist."), 400);
      return c.json(page, 200);
    }
  )

  // One lead's page. Another business's lead gets the same answer as one that never existed.
  .get(
    "/:leadId",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("crm"),
    async (c) => {
      const page = await findLeadPage(c.get("organization").organizationId, c.req.param("leadId"));
      if (!page) return c.json(refuse("not_found", "No lead here."), 404);
      return c.json(page, 200);
    }
  );
