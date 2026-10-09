// Backend: every route the API answers, and AppType, the frontend's typed view of them, with
// PublicAppType, the public routes alone.
// One chain, so AppType carries every route. Importing this starts nothing; server.ts does.

import { Hono } from "hono";

import { auth } from "./lib/auth/auth-server.js";
import { requireOrganizationMiddleware } from "./middleware/auth-middleware/require-organization-middleware.js";
import { dashboardCorsMiddleware } from "./middleware/dashboard-middleware/dashboard-cors-middleware.js";
import { dashboardCsrfMiddleware } from "./middleware/dashboard-middleware/dashboard-csrf-middleware.js";
import { dashboardNoStoreMiddleware } from "./middleware/dashboard-middleware/dashboard-no-store-middleware.js";
import { publicCorsMiddleware } from "./middleware/public-middleware/public-cors-middleware.js";
import { publicRateLimitMiddleware } from "./middleware/public-middleware/public-rate-limit-middleware.js";
import { requireKnownSubscriptionMiddleware } from "./middleware/subscription-middleware/require-known-subscription-middleware.js";
import { adminRoutes } from "./routes/admin-routes.js";
import { calendarRoutes } from "./routes/calendar-routes.js";
import { emailSendingRoutes } from "./routes/email-sending-routes.js";
import { publicRoutes } from "./routes/public-routes.js";
import { publicTextRoutes } from "./routes/public-text-routes.js";

export const app = new Hono()
  // Every dashboard route mounts both; the ones that change something also check the origin.
  .use("/api/auth/*", dashboardCorsMiddleware, dashboardNoStoreMiddleware)
  .use("/me", dashboardCorsMiddleware, dashboardNoStoreMiddleware)
  .use("/calendar/*", dashboardCorsMiddleware, dashboardCsrfMiddleware, dashboardNoStoreMiddleware)
  .use("/admin/*", dashboardCorsMiddleware, dashboardCsrfMiddleware, dashboardNoStoreMiddleware)
  .use(
    "/email-sending",
    dashboardCorsMiddleware,
    dashboardCsrfMiddleware,
    dashboardNoStoreMiddleware
  )
  // Anyone may call these, never with the login cookie: a CORS rule of their own, and limits per
  // visitor. Twilio's signed replies under /texts and the dashboard are not limited.
  .use("/public/*", publicCorsMiddleware, publicRateLimitMiddleware)

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

  .route("/admin", adminRoutes)
  .route("/calendar", calendarRoutes)
  .route("/email-sending", emailSendingRoutes)
  .route("/", publicRoutes) // its routes carry /public themselves
  // Twilio posts customers' replies here, signed; no browser calls it, so no CORS.
  .route("/texts", publicTextRoutes)

  // For Railway. No database on purpose: an outage there should not restart a healthy API.
  .get("/health", (c) => c.json({ ok: true }));

export type AppType = typeof app;

// The public routes alone, for the booking component a client site runs (feature 9).
export type PublicAppType = typeof publicRoutes;
