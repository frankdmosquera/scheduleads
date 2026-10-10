// Frontend: pressing Connect on the Calendar card.

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import type { RefusalType } from "@/lib/api-client/refusal-type";

export type StartCalendarConnectResultType =
  { state: "ok"; url: string } | { state: "refused"; message: string };

// Pressing Connect: the API makes a one-time ticket and answers with Google's address.
export async function startCalendarConnect(): Promise<StartCalendarConnectResultType> {
  const response = await dashboardApiClient.calendar.connect.$post().catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };

  if (response.status === 200) return { state: "ok", url: (await response.json()).url };

  // Refusals come from the middleware or the route, which the route's type only partly lists.
  const body = (await response.json().catch(() => ({}))) as RefusalType;
  return {
    state: "refused",
    message:
      body.error?.message ?? `The API answered with an unexpected status (${response.status}).`,
  };
}
