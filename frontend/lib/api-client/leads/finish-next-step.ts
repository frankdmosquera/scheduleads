// Frontend: a next step ticked done.

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import type { SaveNextStepResultType } from "@/lib/api-client/leads/add-next-step";
import type { RefusalType } from "@/lib/api-client/refusal-type";
import { inDashboardLanguage } from "@/lib/dashboard-words/message-language";

export async function finishNextStep(
  leadId: string,
  nextStepId: string
): Promise<SaveNextStepResultType> {
  const response = await dashboardApiClient.leads[":leadId"]["next-steps"][":nextStepId"].done
    .$post({ param: { leadId, nextStepId } })
    .catch(() => null);
  if (!response) return { state: "refused", message: inDashboardLanguage(apiNotRespondingMessage) };
  if (response.status === 200) return { state: "ok" };
  const status: number = response.status;
  if (status === 401)
    return {
      state: "refused",
      message: inDashboardLanguage("Your sign-in has ended. Sign in again."),
    };
  const body = (await response.json().catch(() => ({}))) as RefusalType;
  return {
    state: "refused",
    message:
      body.error?.message ??
      inDashboardLanguage(`The API answered with an unexpected status (${status}).`),
  };
}
