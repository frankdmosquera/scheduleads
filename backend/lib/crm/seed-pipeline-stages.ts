// Backend: gives a business the four default stages, when it has none. Called by the create
// hook in auth-server.ts; running it twice changes nothing.

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { DEFAULT_PIPELINE_STAGES } from "@scheduleads-app/shared/crm";
import { pipelineStage } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export async function seedPipelineStages(organizationId: string): Promise<void> {
  // A business that has any stage keeps its own: the owner may have renamed them.
  const [anyStage] = await db
    .select({ id: pipelineStage.id })
    .from(pipelineStage)
    .where(eq(pipelineStage.organizationId, organizationId))
    .limit(1);
  if (anyStage) return;

  await db
    .insert(pipelineStage)
    .values(
      DEFAULT_PIPELINE_STAGES.map((name, index) => ({
        id: randomUUID(),
        organizationId,
        name,
        position: index + 1,
      }))
    )
    .onConflictDoNothing(); // two calls at once: the name index keeps one of each
}
