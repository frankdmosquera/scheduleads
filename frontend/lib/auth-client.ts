// Frontend: the browser side of Better Auth, a typed wrapper around the API's auth routes.
// Never import backend/lib/auth/auth-server.ts here: it would ship the secret to Vercel.

import { createAuthClient } from "better-auth/react";
import { adminClient, emailOTPClient, organizationClient } from "better-auth/client/plugins";

// The API's address. Public by nature, so it is the app's only NEXT_PUBLIC_* variable;
// never put a secret behind that prefix. It falls back to localhost instead of throwing,
// because NEXT_PUBLIC_* is baked in at build time and a throw would break local builds.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(
  /\/+$/,
  ""
);

export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`, // must match basePath in auth-server.ts, or every call 404s

  // The login cookie belongs to the API's origin, not this page's. Without "include" the
  // browser never sends it, and every request arrives signed out with no error.
  fetchOptions: { credentials: "include" },

  // Mirrors the server's plugins. A missing one means its methods silently don't exist.
  plugins: [organizationClient(), emailOTPClient(), adminClient()],
});
