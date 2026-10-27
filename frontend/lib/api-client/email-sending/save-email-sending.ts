// Frontend: the owner's Email sending card, saved.

import type { EmailSendingInputType } from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import type { RefusalType } from "@/lib/api-client/refusal-type";
import { inDashboardLanguage } from "@/lib/dashboard-words/message-language";
import {
  emailSendingRoute,
  type EmailSendingStateType,
} from "@/lib/api-client/email-sending/fetch-email-sending";

export type SaveEmailSendingResultType =
  { state: "ok"; answer: EmailSendingStateType } | { state: "refused"; message: string };

// Saving the card: the two addresses (feature 25a).
export async function saveEmailSending(
  input: EmailSendingInputType
): Promise<SaveEmailSendingResultType> {
  const response = await emailSendingRoute.$put({ json: input }).catch(() => null);
  if (!response) return { state: "refused", message: inDashboardLanguage(apiNotRespondingMessage) };
  if (response.status === 200) return { state: "ok", answer: await response.json() };

  const body = (await response.json().catch(() => ({}))) as RefusalType;
  const message =
    body.error?.message ??
    inDashboardLanguage(`The API answered with an unexpected status (${response.status}).`);
  return { state: "refused", message };
}
