// Backend middleware: which business a signed-in request is acting for.
// Every signed-in route runs requireOrganization first.

import { and, eq } from "drizzle-orm";
import { isAPIError } from "better-auth/api";
import { createMiddleware } from "hono/factory";

import { member } from "@scheduleads-app/shared/db";

import { db } from "../database.js";
import { auth } from "./auth-server.js";

export type ActiveOrganizationType = {
  userId: string;
  organizationId: string;
  role: string;
};

export type RefusalCodeType =
  | "unauthenticated" // no session at all
  | "no_active_organization" // signed in, but no single business to act for
  | "forbidden" // their role does not grant this permission
  | "plan_unrecognised" // the tier is not in the config: a misconfiguration
  | "plan_required"; // a real tier that does not include this module

export type RefusalType = {
  error: {
    code: RefusalCodeType;
    message: string;
  };
};

// The one shape every refusal in the API takes. The frontend branches on `code`.
export const refuse = (code: RefusalCodeType, message: string): RefusalType => ({
  error: { code, message },
});

export type AuthSessionType = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

// The business comes from the session and nothing else: never from a body, query,
// path or header. That is the only thing keeping one tenant out of another's data.
export async function getActiveOrganization(
  session: AuthSessionType
): Promise<ActiveOrganizationType | null> {
  const activeOrganizationId = session.session.activeOrganizationId;

  if (activeOrganizationId) {
    // Filtered on the user AND the business, so a session naming a business the
    // user no longer belongs to is not trusted.
    // Drizzle returns an array of rows; this takes the first, or undefined.
    const [activeMembership] = await db
      .select({ organizationId: member.organizationId, role: member.role })
      .from(member)
      .where(
        and(eq(member.userId, session.user.id), eq(member.organizationId, activeOrganizationId))
      )
      .limit(1);

    if (activeMembership) {
      return { userId: session.user.id, ...activeMembership };
    }
  }

  // Backstop for a session with no business stamped on it (the sign-in hook in
  // auth-server.ts normally does that).
  const memberships = await db
    .select({ organizationId: member.organizationId, role: member.role })
    .from(member)
    .where(eq(member.userId, session.user.id));

  // Two or more: refuse rather than guess which tenant was meant. The frontend asks.
  const belongsToExactlyOneBusiness = memberships.length === 1;
  if (!belongsToExactlyOneBusiness) return null;

  const onlyMembership = memberships[0];

  return {
    userId: session.user.id,
    organizationId: onlyMembership.organizationId,
    role: onlyMembership.role,
  };
}

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

export const requireOrganization = createMiddleware(async (c, next) => {
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

// What a route can require, e.g. { organization: ["update"] }. Typed from the
// permission list in auth-server.ts, so an action that does not exist won't compile.
export type PermissionsType = NonNullable<
  Parameters<typeof auth.api.hasPermission>[0]
>["body"]["permissions"];

// A function that makes a middleware: requirePermission({ member: ["delete"] }).
// Asks what the person may do, never which role they hold, so custom roles work
// the day dynamic access control is switched on.
export const requirePermission = (permissions: PermissionsType) =>
  createMiddleware(async (c, next) => {
    const org = c.get("org");

    // Mount after requireOrganization: it reads the business that one resolved.
    if (!org) {
      throw new Error(
        "requirePermission ran without requireOrganization before it. Mount them in that order."
      );
    }

    // Checked against the business requireOrganization resolved, not whatever the
    // session names. Better Auth re-reads the session and membership: two extra
    // queries, only on routes that use this.
    const allowed = await auth.api
      .hasPermission({
        headers: c.req.raw.headers,
        body: { organizationId: org.organizationId, permissions },
      })
      .then((result) => result.success)
      .catch((error: unknown) => {
        if (isAPIError(error)) return false; // Better Auth said no
        throw error; // anything else is a real fault, not a refusal
      });

    // 403 forbidden: signed in and scoped, but their role does not grant this.
    if (!allowed) {
      return c.json(refuse("forbidden", "Your role in this business does not allow this."), 403);
    }

    await next();
  });
