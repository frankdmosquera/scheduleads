// Backend: adds the job for one of a booked worker's texts (feature 8c), inside the change's own
// transaction (8a, decision 1). Added whatever the person's settings say now: the job reads them
// when it runs.

import type { DatabaseExecutorType } from "../../database-executor-type.js";
import { enqueueJob } from "./enqueue-job.js";
import { jobNames } from "./job-names.js";
import type { WorkerTextJobPayloadType } from "./worker-text-job.js";

export async function enqueueWorkerText(
  executor: DatabaseExecutorType,
  payload: WorkerTextJobPayloadType
): Promise<void> {
  await enqueueJob(executor, jobNames.workerText, payload);
}
