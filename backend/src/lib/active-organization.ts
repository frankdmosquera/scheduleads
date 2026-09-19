import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";

import { member } from "@scheduleads-app/shared/db";

import { db } from "../database.js";
import { auth } from "./auth.js";

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

export type ActiveOrganization = {
  userId: string;
  organizationId: string;
  role: string;
};

/**
 * The refusal shape every guard and gate in this API shares. Fixed here so
 * later items reuse one contract instead of each inventing their own.
 */
export type Refusal = {
  error: {
    code: "unauthenticated" | "no_active_organization" | "forbidden";
    message: string;
  };
};

const refuse = (code: Refusal["error"]["code"], message: string): Refusal => ({
  error: { code, message },
});

/**
 * Resolves the active organization from the session alone.
 *
 * Three attempts, in order:
 *
 * 1. Better Auth's active member, when the session carries an active
 *    organization.
 * 2. A membership lookup, for the returning user whose session never had
 *    one stamped. The session-create hook in `auth.ts` covers new sessions,
 *    but this stays as the backstop for any session created before it
 *    existed, and for paths that bypass the hook.
 * 3. Nothing. With two or more memberships and no active choice, picking
 *    one would be guessing which tenant the user meant. The caller is
 *    refused and the frontend asks them.
 */
export async function getActiveOrganization(
  headers: Headers
): Promise<ActiveOrganization | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;

  try {
    const active = await auth.api.getActiveMember({ headers });
    if (active) {
      return {
        userId: session.user.id,
        organizationId: active.organizationId,
        role: active.role,
      };
    }
  } catch {
    // Better Auth throws rather than returning null when the session has
    // no active organization, so the absence has to be caught rather than
    // tested for. Falls through to the membership lookup.
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

declare module "hono" {
  interface ContextVariableMap {
    org: ActiveOrganization;
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

  const active = await getActiveOrganization(c.req.raw.headers);
  if (!active) {
    return c.json(
      refuse(
        "no_active_organization",
        "Choose which business you are working in before continuing."
      ),
      403
    );
  }

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
