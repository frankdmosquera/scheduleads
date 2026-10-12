// Frontend: the business's text choices saved from the Texts page. Never the texting number.

import type { InferResponseType } from "hono/client";

import type { TextChoicesInputType } from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { textsRoute } from "@/lib/api-client/settings/fetch-texts";
import { readSaveRefusal, type SaveResultType } from "@/lib/api-client/settings/read-save-refusal";

export type SavedTextsType = InferResponseType<typeof textsRoute.$put, 200>;

export async function saveTexts(
  choices: TextChoicesInputType
): Promise<SaveResultType<SavedTextsType>> {
  const response = await textsRoute.$put({ json: choices }).catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return readSaveRefusal(response);
}
