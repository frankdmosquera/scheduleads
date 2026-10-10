// Frontend: what reading a Settings page comes back as, and an answer read into it. Every page reads
// the same way: its own data, an ended sign-in, a refusal, or an API that did not answer.

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import type { RefusalType } from "@/lib/api-client/refusal-type";

export type SettingsReadResultType<Answer> =
  | { state: "ok"; answer: Answer }
  | { state: "signed-out" }
  | { state: "refused"; message: string }
  | { state: "unreachable"; message: string };

export async function readSettingsResponse<Answer>(
  response: { status: number; json: () => Promise<unknown> } | null,
  refusedMessage: string // when a 403 carries no message of its own
): Promise<SettingsReadResultType<Answer>> {
  if (!response) return { state: "unreachable", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", answer: (await response.json()) as Answer };
  // From the middleware, which the route's type does not list: an ended sign-in, or a refusal.
  if (response.status === 401) return { state: "signed-out" };
  if (response.status === 403) {
    const body = (await response.json().catch(() => ({}))) as RefusalType;
    return { state: "refused", message: body.error?.message ?? refusedMessage };
  }
  return {
    state: "unreachable",
    message: `The API answered with an unexpected status (${response.status}).`,
  };
}
