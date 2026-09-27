// Backend: every route the API answers, and AppType, the frontend's typed view of them.
// One chain, so AppType carries every route. Importing this starts nothing; server.ts does.

import { Hono } from "hono";

import { auth } from "./lib/auth/auth-server.js";
import { requireOrganizationMiddleware } from "./middleware/auth-middleware/require-organization-middleware.js";
import { dashboardCorsMiddleware } from "./middleware/dashboard-middleware/dashboard-cors-middleware.js";
import { dashboardNoStoreMiddleware } from "./middleware/dashboard-middleware/dashboard-no-store-middleware.js";
import { publicCorsMiddleware } from "./middleware/public-middleware/public-cors-middleware.js";
import { requireKnownSubscriptionMiddleware } from "./middleware/subscription-middleware/require-known-subscription-middleware.js";
import { publicBookingLinksRoutes } from "./routes/public-booking-links-routes.js";

export const app = new Hono()
  // Every dashboard route mounts both.
  .use("/api/auth/*", dashboardCorsMiddleware, dashboardNoStoreMiddleware)
  .use("/me", dashboardCorsMiddleware, dashboardNoStoreMiddleware)
  // Anyone may read these, never with the login cookie: a CORS rule of their own.
  .use("/public/*", publicCorsMiddleware)

  // Better Auth owns every route under this path.
  .on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))

  // The dashboard's first call: who is signed in, which business, and what it paid for.
  // It only requires a real tier, not a module; each module's own route checks that.
  .get("/me", requireOrganizationMiddleware, requireKnownSubscriptionMiddleware, async (c) => {
    // All loaded by the middleware above, so this route makes no query of its own.
    const user = c.get("user");
    const activeOrganization = c.get("organization");
    const details = c.get("organizationDetails");
    const subscription = c.get("subscription");

    return c.json({
      user: { id: user.id, email: user.email, name: user.name },
      organization: {
        id: activeOrganization.organizationId,
        name: details.name,
        slug: details.slug,
        plan: subscription.tier,
      },
      role: activeOrganization.role,
      limits: subscription.limits,
    });
  })

  .route("/public", publicBookingLinksRoutes)

  // For Railway. No database on purpose: an outage there should not restart a healthy API.
  .get("/health", (c) => c.json({ ok: true }));

export type AppType = typeof app;
