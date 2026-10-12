// Frontend: taking time off away on the Calendar page (feature 12b).

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import type { RefusalType } from "@/lib/api-client/refusal-type";

export async function removeTimeOff(
  timeOffId: string
): Promise<{ state: "ok" } | { state: "refused"; message: string }> {
  const response = await dashboardApiClient.schedule["time-off"][":timeOffId"]
    .$delete({ param: { timeOffId } })
    .catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };
  if (response.status === 204) return { state: "ok" };
  const body = (await response.json().catch(() => ({}))) as RefusalType;
  return {
    state: "refused",
    message:
      body.error?.message ?? `The API answered with an unexpected status (${response.status}).`,
  };
}
