// Every signed-in route runs this first: who is signed in, and which business.

import { createMiddleware } from "hono/factory";

import { auth } from "../../lib/auth-server.js";
import {
  getActiveOrganization,
  type ActiveOrganizationType,
} from "../../lib/organization/get-active-organization.js";
import { refuse } from "../../lib/refusal/refuse.js";

// The person, kept apart from the business: an audit trail records one, a lead belongs to the other.
export type SessionUserType = {
  id: string;
  email: string;
  name: string;
};

// Adds `user` and `org` to Hono's context, so c.set / c.get are type-checked.
declare module "hono" {
  interface ContextVariableMap {
    user: SessionUserType;
    org: ActiveOrganizationType;
  }
}

export const requireOrganizationMiddleware = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  // 401 unauthenticated: no session at all, so the browser is sent to sign in.
  if (!session) {
    return c.json(refuse("unauthenticated", "Sign in to continue."), 401);
  }

  // The session is passed in, not re-read, to save a database query on every request.
  const activeOrganization = await getActiveOrganization(session);
  // 403 no_active_organization: signed in, but no single business to act for.
  if (!activeOrganization) {
    return c.json(
      refuse(
        "no_active_organization",
        "Choose which business you are working in before continuing."
      ),
      403
    );
  }

  c.set("user", {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? "", // accounts made by email code have no name
  });
  c.set("org", activeOrganization);
  await next();
});
