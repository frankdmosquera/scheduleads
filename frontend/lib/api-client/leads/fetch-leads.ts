// Frontend: the owner's leads list, one page at a time.

import type { InferResponseType } from "hono/client";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import type { RefusalType } from "@/lib/api-client/refusal-type";

const leadsRoute = dashboardApiClient.leads;

export type LeadsPageType = InferResponseType<typeof leadsRoute.$get, 200>;

export type LeadsListRowType = LeadsPageType["leads"][number];

export type LeadsResultType =
  | { state: "ok"; page: LeadsPageType }
  | { state: "signed-out" }
  | { state: "refused"; message: string }
  | { state: "unreachable"; message: string };

// `after` is the last lead already shown, or nothing for the first page.
export async function fetchLeads(after?: string): Promise<LeadsResultType> {
  // An empty after is the first page: the route reads it as none.
  const response = await leadsRoute.$get({ query: { after: after ?? "" } }).catch(() => null);
  if (!response) return { state: "unreachable", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", page: await response.json() };
  // From the middleware, which the route's type does not list: an ended sign-in, or a refusal.
  const status: number = response.status;
  if (status === 401) return { state: "signed-out" };
  if (status === 403) {
    const body = (await response.json().catch(() => ({}))) as RefusalType;
    return { state: "refused", message: body.error?.message ?? "This business cannot see leads." };
  }
  return {
    state: "unreachable",
    message: `The API answered with an unexpected status (${status}).`,
  };
}
