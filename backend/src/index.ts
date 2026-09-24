import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";

import { requireOrganization } from "./lib/active-organization.js";
import { appOrigin, auth } from "./lib/auth-server.js";
import { requireKnownSubscription } from "./lib/subscription-middleware.js";

const app = new Hono();

/**
 * Two CORS policies, deliberately not one.
 *
 * The dashboard holds a session, so its origin must be allowed to send
 * credentials. There is exactly one of it, named by APP_ORIGIN.
 *
 * The booking widget runs on client websites and reads public data. Its
 * origins arrive later with item 2 and must never be allowed to send
 * credentials: a site that could attach the owner's session cookie to a
 * request could act as the owner. Merging the two lists is how that
 * happens by accident, so they never touch.
 *
 * `appOrigin` comes from `auth-server.ts`, which also makes it Better Auth's one
 * trusted origin and refuses to boot in production without it.
 */

const dashboardCors = cors({
  origin: appOrigin,
  allowHeaders: ["Content-Type"],
  allowMethods: ["GET", "POST", "OPTIONS"],
  credentials: true,
});

/**
 * Signed-in answers are one business's data and must never be stored by a
 * browser or a proxy, or the next person on that machine could be shown
 * them. Every dashboard route mounts this next to `dashboardCors`.
 */
const dashboardNoStore = createMiddleware(async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

app.use("/api/auth/*", dashboardCors, dashboardNoStore);
app.use("/me", dashboardCors, dashboardNoStore);

/** Better Auth owns every route beneath this path. */
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

/**
 * What the dashboard asks for first: who is signed in, which business
 * they are acting for, and what that business has paid for.
 *
 * Behind the subscription middleware on purpose. A business on a tier nothing
 * recognises is misconfigured and has no working product, so the
 * dashboard should say so plainly rather than render an empty shell.
 *
 * It asks only that the tier be recognised, not for any module. This is
 * the front door to every module, so a business on any real tier gets
 * in and each module's own route checks what the tier unlocks. Until
 * 2026-09-23 it asked for `crm`, which enforced a different rule from
 * the one written here; see `subscription-middleware.ts`.
 *
 * Returns nothing about any other organization. That is not a detail of
 * this route, it is the rule the whole product rests on.
 */
app.get("/me", requireOrganization, requireKnownSubscription, async (c) => {
  // Everything here was loaded by the middleware above, scoped by the id
  // the session resolved to, so the handler makes no query of its own. A
  // business that vanished since sign-in is refused by the subscription middleware before this
  // runs, which is why there is no missing-row branch here any more.
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

/**
 * Liveness only: it answers if the process is up, and deliberately does
 * not touch the database, so a failing health check means "the API is
 * down" rather than "something downstream is".
 */
app.get("/health", (c) => c.json({ ok: true }));

// 3001, not 3000. A Next frontend takes 3000, so the two would collide.
// Override with PORT in .env when deploying.
const port = Number(process.env.PORT ?? 3001);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`PORT must be a valid port number, received: ${process.env.PORT}`);
}

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`);
  console.log(`[api] dashboard origin allowed with credentials: ${appOrigin}`);
});
