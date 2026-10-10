// Frontend: a lead typed in by hand, saved.

import type { AddLeadInputType } from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import type { RefusalType } from "@/lib/api-client/refusal-type";

export type AddLeadResultType =
  | { state: "ok"; leadId: string; joinedExistingContact: boolean }
  | { state: "field"; field: "name" | "phone" | "email" | "details"; message: string }
  | { state: "refused"; message: string };

const FIELDS = ["name", "phone", "email", "details"] as const;

export async function addLead(input: AddLeadInputType): Promise<AddLeadResultType> {
  const response = await dashboardApiClient.leads.$post({ json: input }).catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };
  if (response.status === 200 || response.status === 201) {
    const { leadId, joinedExistingContact } = await response.json();
    return { state: "ok", leadId, joinedExistingContact };
  }
  const status: number = response.status;
  const body = (await response.json().catch(() => ({}))) as RefusalType & { field?: string };
  const message = body.error?.message ?? `The API answered with an unexpected status (${status}).`;
  if (status === 401)
    return { state: "refused", message: "Your sign-in has ended. Sign in again." };
  const field = FIELDS.find((name) => name === body.field);
  if (status === 400 && field) return { state: "field", field, message };
  return { state: "refused", message };
}
