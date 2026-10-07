// Backend: adds one job per text a booking change owes (feature 8b), inside that change's own
// transaction (8a, decision 1). Each job decides when it runs whether its text still goes.

import type { DatabaseExecutorType } from "../../database-executor-type.js";
import type { BookingTextJobPayloadType } from "./booking-text-job.js";
import { enqueueJob } from "./enqueue-job.js";
import { jobNames } from "./job-names.js";

export async function enqueueBookingTexts(
  executor: DatabaseExecutorType,
  texts: BookingTextJobPayloadType[]
): Promise<void> {
  for (const text of texts) {
    await enqueueJob(executor, jobNames.bookingText, text);
  }
}
