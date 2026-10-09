// Frontend: the owner's Email sending card, read.

import type { InferResponseType } from "hono/client";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";

export const emailSendingRoute = dashboardApiClient["email-sending"];

// The owner's Email sending card: the two addresses and when the key was saved. Never the key.
export type EmailSendingStateType = InferResponseType<typeof emailSendingRoute.$get, 200>;

export type EmailSendingResultType =
  { state: "ok"; answer: EmailSendingStateType } | { state: "unreachable"; message: string };

export async function fetchEmailSending(): Promise<EmailSendingResultType> {
  const response = await emailSendingRoute.$get().catch(() => null);
  if (!response) return { state: "unreachable", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return {
    state: "unreachable",
    message: `The API answered with an unexpected status (${response.status}).`,
  };
}
