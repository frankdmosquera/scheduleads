// Frontend: the owner's leads list, one page at a time.

import type { InferResponseType } from "hono/client";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";

const leadsRoute = dashboardApiClient.leads;

export type LeadsPageType = InferResponseType<typeof leadsRoute.$get, 200>;

export type LeadsListRowType = LeadsPageType["leads"][number];

export type LeadsResultType =
  { state: "ok"; page: LeadsPageType } | { state: "unreachable"; message: string };

// `after` is the last lead already shown, or nothing for the first page.
export async function fetchLeads(after?: string): Promise<LeadsResultType> {
  // An empty after is the first page: the route reads it as none.
  const response = await leadsRoute.$get({ query: { after: after ?? "" } }).catch(() => null);
  if (!response) return { state: "unreachable", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", page: await response.json() };
  return {
    state: "unreachable",
    message: `The API answered with an unexpected status (${response.status}).`,
  };
}
