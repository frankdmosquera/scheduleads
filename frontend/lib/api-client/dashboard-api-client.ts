// Frontend: the typed client for the dashboard's routes, built from the backend's routes (AppType),
// so a renamed route or a changed answer fails this build. It sends the login cookie, which the
// dashboard routes need and the public routes refuse (the backend's two CORS rules).

import { hc } from "hono/client";

import type { AppType } from "backend/app-type";

import { API_URL } from "@/lib/auth-client";

export const dashboardApiClient = hc<AppType>(API_URL, {
  init: { credentials: "include" }, // send the login cookie, same reason as in auth-client.ts
});
