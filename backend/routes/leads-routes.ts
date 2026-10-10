// Backend: the owner's leads list, each lead's page, adding a lead by hand and the next steps owed.
// The business always comes from the session, never from the request; any member of the business
// whose plan includes the CRM may read them and add to them, since nothing here destroys anything.

import { Hono } from "hono";
import { validator } from "hono/validator";

import {
  addLeadValidationSchema,
  nextStepValidationSchema,
} from "@scheduleads-app/shared/zod-validation";

import { addLeadByHand } from "../lib/crm/add-lead-by-hand.js";
import { addNextStep } from "../lib/crm/add-next-step.js";
import { findLeadPage } from "../lib/crm/find-lead-page.js";
import { findLeadsPage } from "../lib/crm/find-leads-page.js";
import { finishNextStep } from "../lib/crm/finish-next-step.js";
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
  )

  // A lead typed in by hand. 201 for a new one; 200 when this form had already saved it.
  .post(
    "/",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("crm"),
    validator("json", (value, c) => {
      const parsed = addLeadValidationSchema.safeParse(value);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return c.json(
          {
            ...refuse("bad_request", issue?.message ?? "Check the form and try again."),
            field: String(issue?.path[0] ?? ""),
          },
          400
        );
      }
      return parsed.data;
    }),
    async (c) => {
      const added = await addLeadByHand(
        c.get("organization").organizationId,
        c.get("user").id,
        c.req.valid("json")
      );
      const { repeated, ...answer } = added;
      return c.json(answer, repeated ? 200 : 201);
    }
  )

  // A next step owed to the person behind this lead.
  .post(
    "/:leadId/next-steps",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("crm"),
    validator("json", (value, c) => {
      const parsed = nextStepValidationSchema.safeParse(value);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return c.json(
          {
            ...refuse("bad_request", issue?.message ?? "Check the step and try again."),
            field: String(issue?.path[0] ?? ""),
          },
          400
        );
      }
      return parsed.data;
    }),
    async (c) => {
      const added = await addNextStep(
        c.get("organization").organizationId,
        c.req.param("leadId"),
        c.get("user").id,
        c.req.valid("json")
      );
      if (!added) return c.json(refuse("not_found", "No lead here."), 404);
      return c.json(added, 201);
    }
  )

  // Ticks a next step done. Another business's step answers like one that never existed.
  .post(
    "/:leadId/next-steps/:nextStepId/done",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("crm"),
    async (c) => {
      const done = await finishNextStep(
        c.get("organization").organizationId,
        c.req.param("leadId"),
        c.req.param("nextStepId")
      );
      if (!done) return c.json(refuse("not_found", "No next step here."), 404);
      return c.json({ done: true }, 200);
    }
  );
