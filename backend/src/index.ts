import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { requireOrganization } from "./lib/active-organization.js";
import { auth } from "./lib/auth.js";
import { requireModule } from "./lib/plan-gate.js";

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
 */
const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";

const dashboardCors = cors({
  origin: appOrigin,
  allowHeaders: ["Content-Type"],
  allowMethods: ["GET", "POST", "OPTIONS"],
  credentials: true,
});

app.use("/api/auth/*", dashboardCors);
app.use("/me", dashboardCors);

/** Better Auth owns every route beneath this path. */
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

/**
 * What the dashboard asks for first: who is signed in, which business
 * they are acting for, and what that business has paid for.
 *
 * Behind the plan gate on purpose. A business on a rung nothing
 * recognises is misconfigured and has no working product, so the
 * dashboard should say so plainly rather than render an empty shell.
 *
 * Returns nothing about any other organization. That is not a detail of
 * this route, it is the rule the whole product rests on.
 */
app.get("/me", requireOrganization, requireModule("crm"), (c) => {
  const org = c.get("org");
  const plan = c.get("plan");

  return c.json({
    user: { id: org.userId },
    organization: { id: org.organizationId, plan: plan.rung },
    role: org.role,
    limits: plan.limits,
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
