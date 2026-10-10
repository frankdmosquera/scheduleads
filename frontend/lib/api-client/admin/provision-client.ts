// Frontend: the platform admin's "Set up a client" call (the backend's provisionClient).

import type { InferResponseType } from "hono/client";
import type { ProvisionClientInputType } from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import type { RefusalType } from "@/lib/api-client/refusal-type";

const provisionClientRoute = dashboardApiClient.admin.clients;

export type ProvisionedClientType = InferResponseType<typeof provisionClientRoute.$post, 201>;

export type ProvisionClientResultType =
  | { state: "ok"; answer: ProvisionedClientType }
  | {
      state: "field";
      field: "clientEmail" | "businessName" | "emailSendingKey" | "senderEmail";
      message: string;
    }
  | { state: "refused"; message: string };

// The platform admin's "Set up a client": the API makes the client's login and business.
// A taken email or name comes back as a message for that field; anything else for the form.
export async function provisionClient(
  input: ProvisionClientInputType
): Promise<ProvisionClientResultType> {
  const response = await provisionClientRoute.$post({ json: input }).catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };

  if (response.status === 201) return { state: "ok", answer: await response.json() };

  const body = (await response.json().catch(() => ({}))) as RefusalType;
  const message =
    body.error?.message ?? `The API answered with an unexpected status (${response.status}).`;

  if (body.error?.code === "email_taken") return { state: "field", field: "clientEmail", message };
  if (body.error?.code === "slug_taken") return { state: "field", field: "businessName", message };
  if (body.error?.code === "key_refused") {
    return { state: "field", field: "emailSendingKey", message };
  }
  if (body.error?.code === "sender_refused")
    return { state: "field", field: "senderEmail", message };
  return { state: "refused", message };
}
