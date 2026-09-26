// Backend entry point: starts the Hono API and defines its routes.

import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { appOrigin, auth } from "./lib/auth/auth-server.js";
import { dashboardCorsMiddleware } from "./middleware/dashboard/dashboard-cors-middleware.js";
import { dashboardNoStoreMiddleware } from "./middleware/dashboard/dashboard-no-store-middleware.js";
import { requireOrganizationMiddleware } from "./middleware/auth/require-organization-middleware.js";
import { requireKnownSubscriptionMiddleware } from "./middleware/subscription/require-known-subscription-middleware.js";

const app = new Hono();

// Every dashboard route mounts both.
app.use("/api/auth/*", dashboardCorsMiddleware, dashboardNoStoreMiddleware);
app.use("/me", dashboardCorsMiddleware, dashboardNoStoreMiddleware);

// Better Auth owns every route under this path.
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// The dashboard's first call: who is signed in, which business, and what it paid for.
// It only requires a real tier, not a module; each module's own route checks that.
app.get("/me", requireOrganizationMiddleware, requireKnownSubscriptionMiddleware, async (c) => {
  // All loaded by the middleware above, so this route makes no query of its own.
  const user = c.get("user");
  const org = c.get("org");
  const details = c.get("organizationDetails");
  const subscription = c.get("subscription");

  return c.json({
    user: { id: user.id, email: user.email, name: user.name },
    organization: {
      id: org.organizationId,
      name: details.name,
      slug: details.slug,
      plan: subscription.tier,
    },
    role: org.role,
    limits: subscription.limits,
  });
});

// "Is the process up?" for Railway. No database on purpose: a database outage should
// not make Railway restart a healthy API.
app.get("/health", (c) => c.json({ ok: true }));

const port = Number(process.env.PORT ?? 3001); // 3000 is the frontend's

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`PORT must be a valid port number, received: ${process.env.PORT}`);
}

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`);
  console.log(`[api] dashboard origin allowed with credentials: ${appOrigin}`);
});
