// May this person's role do this action? Mounted after requireOrganizationMiddleware.

import { isAPIError } from "better-auth/api";
import { createMiddleware } from "hono/factory";

import { auth } from "../../lib/auth-server.js";
import { refuse } from "../../lib/refusal/refuse.js";

// What a route can require, e.g. { organization: ["update"] }. Typed from the
// permission list in auth-server.ts, so an action that does not exist won't compile.
export type PermissionsType = NonNullable<
  Parameters<typeof auth.api.hasPermission>[0]
>["body"]["permissions"];

// A function that makes a middleware: requirePermissionMiddleware({ member: ["delete"] }).
// Asks what the person may do, never which role they hold, so custom roles work
// the day dynamic access control is switched on.
export const requirePermissionMiddleware = (permissions: PermissionsType) =>
  createMiddleware(async (c, next) => {
    const org = c.get("org");

    // Mount after requireOrganizationMiddleware: it reads the business that one resolved.
    if (!org) {
      throw new Error(
        "requirePermissionMiddleware ran without requireOrganizationMiddleware before it. Mount them in that order."
      );
    }

    // Checked against the business requireOrganizationMiddleware resolved, not whatever
    // the session names. Better Auth re-reads the session and membership: two extra
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
