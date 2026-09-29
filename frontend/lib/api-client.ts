// Frontend: calls to our own API (everything that is not Better Auth), typed from the
// backend's routes (AppType), so a renamed route or a changed answer fails this build.

import { hc, type InferResponseType } from "hono/client";

import type { AppType } from "backend/app-type";

import { API_URL } from "./auth-client";

// Two clients, matching the backend's two CORS rules: the public routes refuse the login
// cookie, and the browser discards any answer to a request that sent it.
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

  // Shown as-is, never dressed up as a known refusal.
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

  // The slug came from /me, so the business exists: a 404 means not open for online
  // booking yet (no hours, or no booking in its plan). Not an error; retrying cannot help.
  if (response.status === 404) return { state: "not-bookable" };

  return {
    state: "unreachable",
    message: `The API answered with an unexpected status (${response.status}).`,
  };
}

const calendarRoutes = dashboardApiClient.calendar;

export type CalendarConnectionAnswerType = InferResponseType<
  typeof calendarRoutes.connection.$get,
  200
>;

export type CalendarConnectionResultType =
  { state: "ok"; answer: CalendarConnectionAnswerType } | { state: "unreachable"; message: string };

// The signed-in person and their calendar connection, for the dashboard card. Never tokens.
export async function fetchCalendarConnection(): Promise<CalendarConnectionResultType> {
  const response = await calendarRoutes.connection.$get().catch(() => null);
  if (!response) return { state: "unreachable", message: notResponding };

  if (response.status === 200) return { state: "ok", answer: await response.json() };

  return {
    state: "unreachable",
    message: `The API answered with an unexpected status (${response.status}).`,
  };
}

export type StartCalendarConnectResultType =
  { state: "ok"; url: string } | { state: "refused"; message: string };

// Pressing Connect: the API makes a one-time ticket and answers with Google's address.
export async function startCalendarConnect(): Promise<StartCalendarConnectResultType> {
  const response = await calendarRoutes.connect.$post().catch(() => null);
  if (!response) return { state: "refused", message: notResponding };

  if (response.status === 200) return { state: "ok", url: (await response.json()).url };

  // Refusals come from the middleware or the route, which the route's type only partly lists.
  const body = (await response.json().catch(() => ({}))) as RefusalType;
  return {
    state: "refused",
    message:
      body.error?.message ?? `The API answered with an unexpected status (${response.status}).`,
  };
}
