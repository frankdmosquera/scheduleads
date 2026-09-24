import { createAuthClient } from "better-auth/react";
import { adminClient, emailOTPClient, organizationClient } from "better-auth/client/plugins";

/**
 * The frontend's half of Better Auth.
 *
 * This is a typed fetch wrapper and nothing more. The session, the
 * secret and the database all live on the Hono API; the only thing that
 * crosses to the browser is a cookie the browser cannot read. Never
 * import `backend/src/lib/auth-server.ts` from this workspace - that module
 * holds BETTER_AUTH_SECRET and the pool, and pulling it in would ship
 * both to Vercel.
 *
 * The plugin list mirrors the server's. Each one contributes the client
 * methods for its own routes, so a plugin missing here is a method that
 * silently does not exist rather than a type error at the call site.
 */

/**
 * Where the API is.
 *
 * Public by definition - it is the origin a browser is about to call -
 * which is why it is the one and only `NEXT_PUBLIC_*` variable this app
 * has. Never put a secret behind that prefix; the prefix means "inline
 * this into the bundle".
 *
 * It falls back to the API's development port rather than throwing when
 * unset, and the reason is worth writing down. A `NEXT_PUBLIC_*` value
 * is inlined at build time, so a throw here fires during `next build`,
 * not in production: it turns every local production build into a
 * failure on a machine that has no deploy to configure. The check that
 * this is actually set belongs to `/release`, which owns deployment
 * readiness and runs against the real environment.
 *
 * A deploy that does miss it is not silent either. The bundle points at
 * localhost, every call fails, and the dashboard renders its
 * "cannot reach the API" state with the URL it tried in the console.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(
  /\/+$/,
  ""
);

export const authClient = createAuthClient({
  /**
   * `basePath` on the server is `/api/auth`, so the client's baseURL
   * carries it. Read off the server config rather than assumed: the two
   * have to agree or every call 404s.
   */
  baseURL: `${API_URL}/api/auth`,

  /**
   * The session cookie is set by a different origin from the one the
   * page is served from - a different port locally, a different
   * subdomain in production. Without `credentials: "include"` the
   * browser neither stores it nor sends it back, and every request
   * arrives unauthenticated with no error to explain why.
   */
  fetchOptions: { credentials: "include" },

  plugins: [organizationClient(), emailOTPClient(), adminClient()],
});
