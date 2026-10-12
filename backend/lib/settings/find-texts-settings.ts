// Backend: what the owner's Texts page shows (feature 12g): the business's texting number, given by
// the agency, and its text choices; null when it has no texts yet.

import { eq } from "drizzle-orm";

import { textSettings } from "@scheduleads-app/shared/db";

import type { DatabaseExecutorType } from "../../database-executor-type.js";

export type TextsSettingsType = {
  fromNumber: string; // as Twilio texts it, "+14035550148"
  confirmationOn: boolean;
  reminderMinutesBefore: number[]; // the earliest first
  replyPhone: string | null;
  replyEmail: string | null;
};

export async function findTextsSettings(
  executor: DatabaseExecutorType,
  organizationId: string
): Promise<TextsSettingsType | null> {
  const [texts] = await executor
    .select({
      fromNumber: textSettings.fromNumber,
      confirmationOn: textSettings.confirmationOn,
      reminderMinutesBefore: textSettings.reminderMinutesBefore,
      replyPhone: textSettings.replyPhone,
      replyEmail: textSettings.replyEmail,
    })
    .from(textSettings)
    .where(eq(textSettings.organizationId, organizationId))
    .limit(1);
  return texts ?? null;
}
