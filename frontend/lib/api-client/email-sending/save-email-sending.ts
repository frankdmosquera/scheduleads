// Frontend: the owner's Email sending card, saved.

import type { EmailSendingInputType } from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import type { RefusalType } from "@/lib/api-client/refusal-type";
import {
  emailSendingRoute,
  type EmailSendingStateType,
} from "@/lib/api-client/email-sending/fetch-email-sending";

export type SaveEmailSendingResultType =
  | { state: "ok"; answer: EmailSendingStateType }
  | { state: "field"; field: "key" | "senderEmail"; message: string }
  | { state: "refused"; message: string };

// Saving the card. A key Resend refused comes back as a message under the key's field.
export async function saveEmailSending(
  input: EmailSendingInputType
): Promise<SaveEmailSendingResultType> {
  const response = await emailSendingRoute.$put({ json: input }).catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", answer: await response.json() };

  const body = (await response.json().catch(() => ({}))) as RefusalType;
  const message =
    body.error?.message ?? `The API answered with an unexpected status (${response.status}).`;
  if (body.error?.code === "key_refused") return { state: "field", field: "key", message };
  if (body.error?.code === "sender_refused")
    return { state: "field", field: "senderEmail", message };
  return { state: "refused", message };
}
