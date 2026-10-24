// Frontend: the typed client for the dashboard's routes, built from the backend's routes (AppType),
// so a renamed route or a changed answer fails this build. It sends the login cookie, which the
// dashboard routes need and the public routes refuse (the backend's two CORS rules).

import { hc } from "hono/client";

import type { AppType } from "backend/app-type";

import { API_URL } from "@/lib/auth-client";
import { inDashboardLanguage } from "@/lib/dashboard-words/message-language";

// A refusal's message, written in the login's language as it arrives (feature 12j). The admin pages
// stay English, so their answers pass untouched, and so does every answer that is not a refusal.
async function fetchInDashboardLanguage(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);
  const url = input instanceof Request ? input.url : String(input);
  if (response.ok || new URL(url).pathname.startsWith("/admin")) return response;
  if (!response.headers.get("content-type")?.includes("application/json")) return response;
  const body = await response
    .clone()
    .json()
    .catch(() => null);
  const message = body?.error?.message;
  if (typeof message !== "string") return response;
  const said = { ...body, error: { ...body.error, message: inDashboardLanguage(message) } };
  const headers = new Headers(response.headers);
  headers.delete("content-length"); // the Spanish is a different length
  return new Response(JSON.stringify(said), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const dashboardApiClient = hc<AppType>(API_URL, {
  init: { credentials: "include" }, // send the login cookie, same reason as in auth-client.ts
  fetch: fetchInDashboardLanguage,
});
