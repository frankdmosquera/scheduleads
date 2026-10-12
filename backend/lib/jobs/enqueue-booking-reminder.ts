// Backend: adds one reminder text's job for a booking, due at the appointment minus its minutes
// (feature 8b), unless that moment has passed. Keyed by the booking, its move and the minutes, so
// adding it again while it waits replaces it: a reminder removed and added back goes once.

import type { DatabaseExecutorType } from "../../database-executor-type.js";
import type { BookingTextJobPayloadType } from "./booking-text-job.js";
import { enqueueJob } from "./enqueue-job.js";
import { jobNames } from "./job-names.js";

const MINUTE_MS = 60_000;

export async function enqueueBookingReminder(
  executor: DatabaseExecutorType,
  reminder: {
    organizationId: string;
    bookingId: string;
    sequence: number; // the booking's move number now
    startsAt: Date;
    minutesBefore: number;
    now: Date;
  }
): Promise<void> {
  const { organizationId, bookingId, sequence, startsAt, minutesBefore, now } = reminder;
  const runAt = new Date(startsAt.getTime() - minutesBefore * MINUTE_MS);
  if (runAt.getTime() <= now.getTime()) return;
  const payload: BookingTextJobPayloadType = {
    organizationId,
    bookingId,
    sequence,
    kind: "reminder",
    minutesBefore,
  };
  await enqueueJob(executor, jobNames.bookingText, payload, {
    runAt,
    jobKey: `booking-reminder:${bookingId}:${sequence}:${minutesBefore}`,
  });
}
