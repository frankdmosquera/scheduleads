// Backend: adds one of a booking's calendar jobs inside the change's own transaction (decision 1),
// always in that booking's lane (decision 5), so no calendar job is ever added outside it.

import type { DatabaseExecutorType } from "../../database-executor-type.js";
import { bookingEventLaneOf } from "./booking-event-lane-of.js";
import type { BookingEventMoveJobPayloadType } from "./booking-event-move-job.js";
import type { BookingEventRemovalJobPayloadType } from "./booking-event-removal-job.js";
import type { BookingEventWriteJobPayloadType } from "./booking-event-write-job.js";
import { enqueueJob } from "./enqueue-job.js";
import { jobNames } from "./job-names.js";

export type BookingEventJobType =
  | { name: typeof jobNames.bookingEventWrite; payload: BookingEventWriteJobPayloadType }
  | { name: typeof jobNames.bookingEventMove; payload: BookingEventMoveJobPayloadType }
  | { name: typeof jobNames.bookingEventRemove; payload: BookingEventRemovalJobPayloadType };

export async function enqueueBookingEventJob(
  executor: DatabaseExecutorType,
  { name, payload }: BookingEventJobType
): Promise<void> {
  await enqueueJob(executor, name, payload, { queueName: bookingEventLaneOf(payload.bookingId) });
}
