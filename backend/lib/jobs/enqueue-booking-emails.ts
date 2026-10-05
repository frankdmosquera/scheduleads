// Backend: adds one job per email a booking change owes (decision 2), inside that change's own
// transaction (decision 1). Each job decides when it runs whether its email still goes.

import type { DatabaseExecutorType } from "../../database-executor-type.js";
import type { BookingEmailKindType } from "../email/send-and-record-emails.js";
import type { BookingEmailJobPayloadType } from "./booking-email-job.js";
import { enqueueJob } from "./enqueue-job.js";
import { jobNames } from "./job-names.js";

export async function enqueueBookingEmails(
  executor: DatabaseExecutorType,
  organizationId: string,
  bookingId: string,
  kinds: BookingEmailKindType[],
  sequence: number
): Promise<void> {
  for (const kind of kinds) {
    const payload: BookingEmailJobPayloadType = { organizationId, bookingId, kind, sequence };
    await enqueueJob(executor, jobNames.bookingEmail, payload);
  }
}
