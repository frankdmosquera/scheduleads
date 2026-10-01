// Backend: a business's first stage, where feature 5 puts a new lead. Null when it has none.

import { asc, eq } from "drizzle-orm";

import { pipelineStage } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export type PipelineStageType = { id: string; name: string; position: number };

export async function findFirstPipelineStage(
  organizationId: string
): Promise<PipelineStageType | null> {
  const [first] = await db
    .select({ id: pipelineStage.id, name: pipelineStage.name, position: pipelineStage.position })
    .from(pipelineStage)
    .where(eq(pipelineStage.organizationId, organizationId))
    .orderBy(asc(pipelineStage.position), asc(pipelineStage.createdAt), asc(pipelineStage.id))
    .limit(1);
  return first ?? null;
}
