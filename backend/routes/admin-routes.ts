// Backend: the platform admin's routes (Frank's hat above every business). Each runs
// requirePlatformAdminMiddleware first; none needs or reads a business from the session.

import { Hono } from "hono";
import { validator } from "hono/validator";

import { provisionClientValidationSchema } from "@scheduleads-app/shared/zod-validation";

import { provisionClient } from "../lib/admin/provision-client.js";
import { refuse } from "../lib/errors/refuse.js";
import { requirePlatformAdminMiddleware } from "../middleware/auth-middleware/require-platform-admin-middleware.js";

const refusals = {
  bad_request: { status: 400, message: "Use at least a couple of letters or numbers in the name." },
  email_taken: { status: 409, message: "That email already has a login." },
  slug_taken: { status: 409, message: "A business with that name already exists." },
  setup_in_progress: {
    status: 409,
    message: "This client is already being set up. Try again in a moment.",
  },
} as const;

export const adminRoutes = new Hono()
  // Setting up a client: their login and their business, made together, with them as owner.
  .post(
    "/clients",
    requirePlatformAdminMiddleware,
    validator("json", (value, c) => {
      const parsed = provisionClientValidationSchema.safeParse(value);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "Check the form and try again.";
        return c.json(refuse("bad_request", message), 400);
      }
      return parsed.data;
    }),
    async (c) => {
      const result = await provisionClient(c.req.valid("json"));

      if (!result.ok) {
        const refusal = refusals[result.code];
        return c.json(refuse(result.code, refusal.message), refusal.status);
      }

      return c.json({ organization: result.organization, client: result.client }, 201);
    }
  );
