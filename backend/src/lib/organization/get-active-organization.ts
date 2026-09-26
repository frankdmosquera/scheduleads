// Which business a signed-in session is acting for. A plain function: it never sees
// the request, so requireOrganizationMiddleware turns its answer into 403 or next().

import { and, eq } from "drizzle-orm";

import { member } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { auth } from "../auth-server.js";

export type ActiveOrganizationType = {
  userId: string;
  organizationId: string;
  role: string;
};

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
