// Every /admin route runs this first: only the platform admin (Frank) gets through.
// Not tied to a business: the platform admin may belong to none.

import { createMiddleware } from "hono/factory";

import { auth } from "../../lib/auth/auth-server.js";
import { refuse } from "../../lib/errors/refuse.js";

export const requirePlatformAdminMiddleware = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json(refuse("unauthenticated", "Sign in to continue."), 401);
  }

  // The platform admin is the one role compared by name (coding standards, Backend): it sits
  // above every business, and dynamic roles never apply to it.
  const isPlatformAdmin = (session.user as { role?: string | null }).role === "admin";
  if (!isPlatformAdmin) {
    return c.json(refuse("forbidden", "Only the agency can do this."), 403);
  }

  await next();
});
