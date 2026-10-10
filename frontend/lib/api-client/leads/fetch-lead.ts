// Frontend: one lead's page: the person, the request, their other requests, next steps and timeline.

import type { InferResponseType } from "hono/client";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import type { RefusalType } from "@/lib/api-client/refusal-type";

const leadRoute = dashboardApiClient.leads[":leadId"];

export type LeadPageType = InferResponseType<typeof leadRoute.$get, 200>;

export type TimelineEntryType = LeadPageType["timeline"][number];

export type LeadResultType =
  | { state: "ok"; page: LeadPageType }
  | { state: "not-found" }
  | { state: "signed-out" }
  | { state: "refused"; message: string }
  | { state: "unreachable"; message: string };

export async function fetchLead(leadId: string): Promise<LeadResultType> {
  const response = await leadRoute.$get({ param: { leadId } }).catch(() => null);
  if (!response) return { state: "unreachable", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", page: await response.json() };
  if (response.status === 404) return { state: "not-found" }; // unknown, or another business's
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
