// Frontend: calls to our own API (everything that is not Better Auth), typed from the
// backend's routes (AppType), so a renamed route or a changed answer fails this build.

import { hc, type InferResponseType } from "hono/client";

import type { AppType } from "backend/app-type";

import { API_URL } from "./auth-client";

// Two clients from one type, matching the backend's two CORS rules. The dashboard's routes
// need the login cookie; the public routes refuse it, and the browser throws away any answer
// to a request that sent it there.
const dashboardApiClient = hc<AppType>(API_URL, {
  init: { credentials: "include" }, // send the login cookie, same reason as in auth-client.ts
});
const publicApiClient = hc<AppType>(API_URL);

const notResponding = "The API is not responding. Check that it is running.";

export type MeType = InferResponseType<typeof dashboardApiClient.me.$get, 200>;

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
  const response = await dashboardApiClient.me.$get().catch(() => null);
  if (!response) return { state: "unreachable", message: notResponding }; // the API is not answering at all

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

  // Anything unexpected is shown as-is, not dressed up as a known refusal that would
  // tell the user to do something that cannot help.
  return {
    state: "unreachable",
    message: `The API answered with an unexpected status (${status}).`,
  };
}

const bookingLinksRoute = publicApiClient.public[":slug"]["booking-links"];

export type BookingLinkType = InferResponseType<
  typeof bookingLinksRoute.$get,
  200
>["bookingLinks"][number];

export type BookingLinksResultType =
  | { state: "ok"; bookingLinks: BookingLinkType[] }
  | { state: "not-bookable" }
  | { state: "unreachable"; message: string };

// A business's active booking links, from the public route a client site will call too.
export async function fetchBookingLinks(slug: string): Promise<BookingLinksResultType> {
  const response = await bookingLinksRoute.$get({ param: { slug } }).catch(() => null);
  if (!response) return { state: "unreachable", message: notResponding };

  if (response.status === 200) {
    const { bookingLinks } = await response.json();
    return { state: "ok", bookingLinks };
  }

  // The slug came from /me, so the business exists: the public 404 here means it is not
  // open for online booking yet (no bookable hours until feature 12, or a plan without
  // booking). Trying again cannot change that, so it is not shown as an error (F-29).
  if (response.status === 404) return { state: "not-bookable" };

  return {
    state: "unreachable",
    message: `The API answered with an unexpected status (${response.status}).`,
  };
}
