// Frontend: calls to our own API (everything that is not Better Auth).
// The types below are written by hand until item 2 wires Hono RPC, which replaces them.

import type { SubscriptionLimitsType } from "@scheduleads-app/shared/subscriptions";

import { API_URL } from "./auth-client";

export type MeType = {
  user: { id: string; email: string; name: string };
  organization: { id: string; name: string; slug: string; plan: string };
  role: string;
  limits: SubscriptionLimitsType;
};

// One state per screen, so the user sees "sign in" or "pick a business" instead of a
// generic "something went wrong".
export type MeResultType =
  | { state: "ok"; me: MeType }
  | { state: "signed-out" }
  | { state: "no-organization" }
  | { state: "plan-refused"; message: string }
  | { state: "unreachable"; message: string };

// The API's refusal shape. Loosely typed on purpose: unknown codes fall through.
export type RefusalType = {
  error?: { code?: string; message?: string };
};

export async function fetchMe(): Promise<MeResultType> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/me`, {
      credentials: "include", // send the login cookie, same reason as in auth-client.ts
      headers: { Accept: "application/json" },
    });
  } catch {
    // The API is not answering at all.
    return {
      state: "unreachable",
      message: "The API is not responding. Check that it is running.",
    };
  }

  if (response.ok) {
    return { state: "ok", me: (await response.json()) as MeType };
  }

  if (response.status === 401) return { state: "signed-out" };

  if (response.status === 403) {
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

  // Anything unexpected is shown as-is, not dressed up as a known refusal that would
  // tell the user to do something that cannot help.
  return {
    state: "unreachable",
    message: `The API answered with an unexpected status (${response.status}).`,
  };
}
