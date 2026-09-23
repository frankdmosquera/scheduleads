import type { PlanLimits } from "@scheduleads-app/shared/config";

import { API_URL } from "./auth-client";

/**
 * The dashboard's one call to the API that is not Better Auth's.
 *
 * The response shape is written out by hand here on purpose. Feature 1's
 * only other traffic goes through the auth client, which carries its own
 * types, and the Hono RPC seam that would make this shape shared is
 * build-plan item 2's first job. When it lands, this type is deleted and
 * `hc<AppType>` supplies it instead; until then a hand-written type is
 * honest about being unproven, and a fake `AppType` export would not be.
 */

export type Me = {
  user: { id: string; email: string; name: string };
  organization: { id: string; name: string; slug: string; plan: string };
  role: string;
  limits: PlanLimits;
};

/**
 * Why the four states exist.
 *
 * A dashboard that renders "loading" until something works cannot tell
 * the three ways this call fails apart, and they need three different
 * screens: sign in, pick a business, or the account is misconfigured.
 * Collapsing them into one error page is how a user ends up staring at
 * "something went wrong" with no idea which of those it was.
 */
export type MeResult =
  | { state: "ok"; me: Me }
  | { state: "signed-out" }
  | { state: "no-organization" }
  | { state: "plan-refused"; message: string }
  | { state: "unreachable"; message: string };

/**
 * The refusal shape the API fixed in step 1.3 and reuses everywhere.
 *
 * Only the codes this screen actually branches on are named. Anything
 * else the API adds later falls through to the generic refusal rather
 * than needing this list kept in step with it.
 */
type Refusal = {
  error?: { code?: string; message?: string };
};

export async function fetchMe(): Promise<MeResult> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/me`, {
      // Same reason as the auth client: the session cookie belongs to
      // the API's origin, so it only travels on a credentialed request.
      credentials: "include",
      headers: { Accept: "application/json" },
    });
  } catch {
    // The API is not answering at all. Distinct from every refusal
    // below, because none of those are fixed by starting the server.
    return {
      state: "unreachable",
      message: "The API is not responding. Check that it is running.",
    };
  }

  if (response.ok) {
    return { state: "ok", me: (await response.json()) as Me };
  }

  if (response.status === 401) return { state: "signed-out" };

  if (response.status === 403) {
    const body = (await response.json().catch(() => ({}))) as Refusal;
    const code = body.error?.code;

    if (code === "no_active_organization") return { state: "no-organization" };

    // Named rather than assumed. `/me` refuses a plan only when the rung is
    // unrecognised, and the screen this maps to says exactly that, so any
    // other 403 falls through to the unexpected-status answer below rather
    // than being shown a cause that is not the real one.
    if (code === "plan_unrecognised") {
      return {
        state: "plan-refused",
        message:
          body.error?.message ??
          "This business is on a plan the product does not recognise.",
      };
    }
  }

  // An unexpected status is not quietly treated as one of the known
  // refusals. Guessing here would hide a real fault behind a screen that
  // tells the user to do something that cannot help.
  return {
    state: "unreachable",
    message: `The API answered with an unexpected status (${response.status}).`,
  };
}
