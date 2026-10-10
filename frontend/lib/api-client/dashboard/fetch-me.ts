// Frontend: GET /me, the dashboard's first call: who is signed in, which business, and its plan.

import type { InferResponseType } from "hono/client";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import type { RefusalType } from "@/lib/api-client/refusal-type";

export type MeType = InferResponseType<typeof dashboardApiClient.me.$get, 200>;

// One state per screen, so the user sees "sign in" or "pick a business" instead of a
// generic "something went wrong".
export type MeResultType =
  | { state: "ok"; me: MeType }
  | { state: "signed-out" }
  | { state: "no-organization" }
  | { state: "plan-refused"; message: string }
  | { state: "unreachable"; message: string };

export async function fetchMe(): Promise<MeResultType> {
  const response = await dashboardApiClient.me.$get().catch(() => null);
  if (!response) return { state: "unreachable", message: apiNotRespondingMessage }; // the API is not answering at all

  if (response.ok) return { state: "ok", me: await response.json() };

  // The 401 and 403 come from the middleware, which the route's type does not list,
  // so the status is read as a plain number here.
  const status: number = response.status;

  if (status === 401) return { state: "signed-out" };

  if (status === 403) {
    const body = (await response.json().catch(() => ({}))) as RefusalType;
    const code = body.error?.code;

    if (code === "no_active_organization") return { state: "no-organization" };

    if (code === "plan_unrecognised") {
      return {
        state: "plan-refused",
        message:
          body.error?.message ?? "This business is on a plan the product does not recognise.",
      };
    }
  }

  // Shown as-is, never dressed up as a known refusal.
  return {
    state: "unreachable",
    message: `The API answered with an unexpected status (${status}).`,
  };
}
