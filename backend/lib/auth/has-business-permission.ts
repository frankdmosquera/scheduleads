// Backend: may the signed-in person do this in their business? Asked of Better Auth by action,
// never by role name, so custom roles work the day dynamic access control is switched on.

import { isAPIError } from "better-auth/api";

import { auth } from "./auth-server.js";

// What can be asked, e.g. { organization: ["update"] }. Typed from the permission list in
// auth-server.ts, so an action that does not exist won't compile.
export type PermissionsType = NonNullable<
  Parameters<typeof auth.api.hasPermission>[0]
>["body"]["permissions"];

// Better Auth re-reads the session and membership: two extra queries per ask.
export async function hasBusinessPermission(
  headers: Headers,
  organizationId: string,
  permissions: PermissionsType
): Promise<boolean> {
  return auth.api
    .hasPermission({ headers, body: { organizationId, permissions } })
    .then((result) => result.success)
    .catch((error: unknown) => {
      if (isAPIError(error)) return false; // Better Auth said no
      throw error; // anything else is a real fault, not a refusal
    });
}
