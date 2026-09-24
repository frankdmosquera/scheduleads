// Backend entry point: starts the Hono API and defines its routes.

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";

import { requireOrganization } from "./lib/active-organization.js";
import { appOrigin, auth } from "./lib/auth-server.js";
import { requireKnownSubscription } from "./lib/subscription-middleware.js";

const app = new Hono();

// Only the dashboard may call with the login cookie (credentials: true). The booking
// widget on client sites gets its own CORS rule later and must NEVER send the cookie,
// or any client site could act as the owner. Keep the two rules separate.
const dashboardCors = cors({
  origin: appOrigin,
  allowHeaders: ["Content-Type"],
  allowMethods: ["GET", "POST", "OPTIONS"],
  credentials: true,
});

// Tells the browser never to keep a copy of a signed-in answer, so the next person on
// a shared computer cannot see it. Set after next(), on the finished response.
const dashboardNoStore = createMiddleware(async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

// Every dashboard route mounts both.
app.use("/api/auth/*", dashboardCors, dashboardNoStore);
app.use("/me", dashboardCors, dashboardNoStore);

// Better Auth owns every route under this path.
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// The dashboard's first call: who is signed in, which business, and what it paid for.
// It only requires a real tier, not a module; each module's own route checks that.
app.get("/me", requireOrganization, requireKnownSubscription, async (c) => {
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
