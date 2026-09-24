import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";

import { member } from "@scheduleads-app/shared/db";

import { db } from "../database.js";
import { auth } from "./auth-server.js";

/**
 * Which business the caller is acting for, and their role in it.
 *
 * Ported from the first repo's `frontend/lib/active-organization.ts`, with
 * the Next adapters swapped for Hono ones. The reasoning is the part worth
 * carrying over; the framework glue is incidental.
 *
 * **The organization id comes from the session and nothing else.** Never
 * from a request body, a query string, a path parameter or a header. This
 * is where that rule starts, and every route from item 2 to item 26
 * inherits it. Once two businesses can both sign in, that scoping is the
 * only thing stopping one of them reading the other's leads, so it is
 * derived server side or it does not exist.
 */

export type ActiveOrganizationType = {
  userId: string;
  organizationId: string;
  role: string;
};

/**
 * The refusal shape every middleware in this API shares. Fixed here so
 * later items reuse one contract instead of each inventing their own.
 */
export type RefusalCodeType =
  /** No session at all. */
  | "unauthenticated"
  /** A session, but no single business to act for. Not the same as signed out. */
  | "no_active_organization"
  /** Signed in and scoped, but the role is not allowed to do this. */
  | "forbidden"
  /**
   * Signed in and scoped, but the business is on a tier the config does not
   * define. A misconfiguration, never a cheaper tier, so it is kept apart
   * from `plan_required`: telling a real customer their plan is unknown when
   * it merely excludes a module is a false statement about their account.
   */
  | "plan_unrecognised"
  /** Signed in, scoped, on a real tier, but that tier does not include it. */
  | "plan_required";

export type RefusalType = {
  error: {
    code: RefusalCodeType;
    message: string;
  };
};

/**
 * The one way to build a refusal. Exported because a contract only two of
 * four call sites can reach is documentation, not a contract: the spec said
 * to fix the shape once and reuse it, and an unexported helper meant the
 * subscription middleware and the first route each hand-rolled the object instead. Items 2 to
 * 26 copy whatever they find here, so there is one thing to find.
 */
export const refuse = (code: RefusalCodeType, message: string): RefusalType => ({
  error: { code, message },
});

/**
 * The session as Better Auth resolves it, carrying the organization
 * plugin's `activeOrganizationId`.
 */
export type AuthSessionType = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

/**
 * Resolves the active organization from the session alone.
 *
 * Takes the session, not the request headers. It used to take the headers,
 * resolve the session again itself, and then call Better Auth's
 * `getActiveMember`, which resolves it a third time inside its own
 * middleware. With no cookie cache each of those is a database read, on the
 * route every dashboard load starts with. The caller has the session
 * already, so it hands it over.
 *
 * Three attempts, in order:
 *
 * 1. The member row for the session's active organization, when it has one.
 *    This is what `getActiveMember` did, read off better-auth 1.7.5
 *    `crud-members.mjs:396-402`: one lookup filtered on the user **and** the
 *    organization. Both filters matter. Filtering on the organization alone
 *    would trust that `activeOrganizationId` was checked when it was set,
 *    and this is the line where that trust is verified instead.
 * 2. A membership lookup, for the returning user whose session never had
 *    one stamped. The session-create hook in `auth-server.ts` covers new sessions,
 *    but this stays as the backstop for any session created before it
 *    existed, and for paths that bypass the hook.
 * 3. Nothing. With two or more memberships and no active choice, picking
 *    one would be guessing which tenant the user meant. The caller is
 *    refused and the frontend asks them.
 */
export async function getActiveOrganization(
  session: AuthSessionType
): Promise<ActiveOrganizationType | null> {
  const activeOrganizationId = session.session.activeOrganizationId;

  if (activeOrganizationId) {
    const [active] = await db
      .select({ organizationId: member.organizationId, role: member.role })
      .from(member)
      .where(
        and(
          eq(member.userId, session.user.id),
          eq(member.organizationId, activeOrganizationId)
        )
      )
      .limit(1);

    if (active) {
      return { userId: session.user.id, ...active };
    }

    // The session names a business this user no longer belongs to. Not
    // trusted: falls through to the membership lookup, as the Better Auth
    // call this replaces did by throwing MEMBER_NOT_FOUND.
  }

  const memberships = await db
    .select({ organizationId: member.organizationId, role: member.role })
    .from(member)
    .where(eq(member.userId, session.user.id))
    .limit(2);

  // Exactly one, or nothing. See attempt 3 above.
  if (memberships.length !== 1) return null;

  return {
    userId: session.user.id,
    organizationId: memberships[0].organizationId,
    role: memberships[0].role,
  };
}

/**
 * Who is signed in, as distinct from which business they are acting for.
 *
 * Two context variables rather than one widened `org`, because they
 * answer two different questions and later items want them apart: an
 * audit trail records the person, a lead record belongs to the business.
 */
export type SessionUserType = {
  id: string;
  email: string;
  name: string;
};

declare module "hono" {
  interface ContextVariableMap {
    user: SessionUserType;
    org: ActiveOrganizationType;
  }
}

/**
 * Puts the caller's business on the request context, or refuses.
 *
 * 401 when there is no session at all. 403 when there is a session but no
 * single organization to act for, which is the two-membership case: the
 * caller is signed in, they just have not said who they are acting as.
 */
export const requireOrganization = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json(refuse("unauthenticated", "Sign in to continue."), 401);
  }

  const active = await getActiveOrganization(session);
  if (!active) {
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
    // An account created by email code has no name: Better Auth stores
    // `name: name || ""` on that path. The dashboard shows the email
    // until something asks for a name, rather than inventing one.
    name: session.user.name ?? "",
  });
  c.set("org", active);
  await next();
});

/**
 * Narrows to a role within the already-resolved organization.
 *
 * Only an owner may connect or disconnect the business calendar (item 3)
 * or change its hours and services (item 12). A member quietly gaining the
 * ability to redirect where the whole business's bookings land is not a
 * default worth shipping. Refused on the server, not merely hidden in the
 * interface.
 *
 * Mount after `requireOrganization`; it reads what that put on the context.
 */
export const requireOrgRole = (...allowed: string[]) =>
  createMiddleware(async (c, next) => {
    const org = c.get("org");

    if (!org) {
      throw new Error(
        "requireOrgRole ran without requireOrganization before it. Mount them in that order."
      );
    }

    if (!allowed.includes(org.role)) {
      return c.json(
        refuse(
          "forbidden",
          `This action needs the ${allowed.join(" or ")} role.`
        ),
        403
      );
    }

    await next();
  });
