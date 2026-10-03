// Backend: the owner's "Email sending" card. The business always comes from the session, never
// from the request; only a role that may change the business may save. No answer ever carries
// the business's Resend key (decision 6).

import { Hono } from "hono";
import { validator } from "hono/validator";

import { emailSendingValidationSchema } from "@scheduleads-app/shared/zod-validation";

import { findEmailSendingState } from "../lib/email/find-email-sending-state.js";
import { saveEmailSending } from "../lib/email/save-email-sending.js";
import { refuse } from "../lib/errors/refuse.js";
import { requireOrganizationMiddleware } from "../middleware/auth-middleware/require-organization-middleware.js";
import { requirePermissionMiddleware } from "../middleware/auth-middleware/require-permission-middleware.js";
import { requireKnownSubscriptionMiddleware } from "../middleware/subscription-middleware/require-known-subscription-middleware.js";
import { requireModuleMiddleware } from "../middleware/subscription-middleware/require-module-middleware.js";

export const emailSendingRoutes = new Hono()
  // The card: the two addresses and when the key was saved.
  .get(
    "/",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    async (c) => {
      const state = await findEmailSendingState(c.get("organization").organizationId);
      return c.json(state, 200);
    }
  )

  // Saving the card: a test email first whenever a key is there (decision 9).
  .put(
    "/",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware({ organization: ["update"] }),
    validator("json", (value, c) => {
      const parsed = emailSendingValidationSchema.safeParse(value);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "Check the card and try again.";
        return c.json(refuse("bad_request", message), 400);
      }
      return parsed.data;
    }),
    async (c) => {
      const input = c.req.valid("json");
      const result = await saveEmailSending(c.get("organization").organizationId, {
        senderEmail: input.senderEmail,
        notifyEmail: input.notifyEmail,
        key: input.key || null,
      });
      if (!result.ok) return c.json(refuse("key_refused", result.reason), 422);
      return c.json(result.state, 200);
    }
  );
