// May this person's role do this action? Mounted after requireOrganizationMiddleware.

import { createMiddleware } from "hono/factory";

import {
  hasBusinessPermission,
  type PermissionsType,
} from "../../lib/auth/has-business-permission.js";
import { refuse } from "../../lib/errors/refuse.js";

// Asks what the person may do, never which role they hold, so custom roles work the day
// dynamic access control is switched on.
export const requirePermissionMiddleware = (permissions: PermissionsType) =>
  createMiddleware(async (c, next) => {
    const activeOrganization = c.get("organization");

    if (!activeOrganization) {
      throw new Error(
        "requirePermissionMiddleware ran without requireOrganizationMiddleware before it. Mount them in that order."
      );
    }

    // Checked against the business requireOrganizationMiddleware resolved, not whatever
    // the session names.
    const allowed = await hasBusinessPermission(
      c.req.raw.headers,
      activeOrganization.organizationId,
      permissions
    );

    if (!allowed) {
      return c.json(refuse("forbidden", "Your role in this business does not allow this."), 403);
    }

    await next();
  });
