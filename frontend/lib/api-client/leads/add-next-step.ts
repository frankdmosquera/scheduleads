// Frontend: a next step owed to the person behind a lead, saved.

import type { NextStepInputType } from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import type { RefusalType } from "@/lib/api-client/refusal-type";

export type SaveNextStepResultType = { state: "ok" } | { state: "refused"; message: string };

export async function addNextStep(
  leadId: string,
  input: NextStepInputType
): Promise<SaveNextStepResultType> {
  const response = await dashboardApiClient.leads[":leadId"]["next-steps"]
    .$post({ param: { leadId }, json: input })
    .catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };
  if (response.status === 201) return { state: "ok" };
  const status: number = response.status;
  if (status === 401)
    return { state: "refused", message: "Your sign-in has ended. Sign in again." };
  const body = (await response.json().catch(() => ({}))) as RefusalType;
  return {
    state: "refused",
    message: body.error?.message ?? `The API answered with an unexpected status (${status}).`,
  };
}
