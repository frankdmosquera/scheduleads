// Backend: every person's worker texts in one business, for the People page (feature 12g): their
// phone and their three choices. A person with none gets no texts.

import { eq } from "drizzle-orm";

import { workerTextSettings } from "@scheduleads-app/shared/db";

import type { DatabaseExecutorType } from "../../database-executor-type.js";
import type { WorkerTextSettingsRowType } from "../text/find-worker-text-settings.js";

export async function findWorkerTexts(
  executor: DatabaseExecutorType,
  organizationId: string
): Promise<(WorkerTextSettingsRowType & { personId: string })[]> {
  return executor
    .select({
      personId: workerTextSettings.personId,
      phone: workerTextSettings.phone,
      addedOn: workerTextSettings.addedOn,
      movedOn: workerTextSettings.movedOn,
      removedOn: workerTextSettings.removedOn,
    })
    .from(workerTextSettings)
    .where(eq(workerTextSettings.organizationId, organizationId));
}
