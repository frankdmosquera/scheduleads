// Backend: keeps a business's own Resend key, locked with the token cipher and bound to the
// business, replacing any earlier one (decision 6). Only after checkEmailSendingKey passed.

import { emailSendingKey } from "@scheduleads-app/shared/db";
import { encryptCredentials, readTokenKey } from "@scheduleads-app/shared/crypto";

import { db } from "../../database.js";
import type { DatabaseExecutorType } from "../../database-executor-type.js";

export async function storeEmailSendingKey(
  organizationId: string,
  apiKey: string,
  executor: DatabaseExecutorType = db
): Promise<{ savedAt: Date }> {
  const credentials = encryptCredentials(apiKey, readTokenKey(), organizationId);
  const savedAt = new Date();
  await executor
    .insert(emailSendingKey)
    .values({ organizationId, credentials, savedAt })
    .onConflictDoUpdate({ target: emailSendingKey.organizationId, set: { credentials, savedAt } });
  return { savedAt };
}
