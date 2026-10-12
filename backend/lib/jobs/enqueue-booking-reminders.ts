// Backend: adds booking reminder texts' jobs (feature 8b), each due at its appointment minus its
// minutes, unless that moment has passed. Each is keyed by its booking, move and minutes, so adding
// one again while it waits replaces it: a reminder removed and added back goes once. All in one SQL
// call, however many.

import type { DatabaseExecutorType } from "../../database-executor-type.js";
import type { BookingTextJobPayloadType } from "./booking-text-job.js";
import { enqueueJobs } from "./enqueue-jobs.js";
import { jobNames } from "./job-names.js";

const MINUTE_MS = 60_000;

export async function enqueueBookingReminders(
  executor: DatabaseExecutorType,
  reminders: {
    organizationId: string;
    bookingId: string;
    sequence: number; // the booking's move number now
    startsAt: Date;
    minutesBefore: number;
  }[],
  now: Date
): Promise<void> {
  const due = reminders.flatMap(
    ({ organizationId, bookingId, sequence, startsAt, minutesBefore }) => {
      const runAt = new Date(startsAt.getTime() - minutesBefore * MINUTE_MS);
      if (runAt.getTime() <= now.getTime()) return [];
      const payload: BookingTextJobPayloadType = {
        organizationId,
        bookingId,
        sequence,
        kind: "reminder",
        minutesBefore,
      };
      return [
        { payload, runAt, jobKey: `booking-reminder:${bookingId}:${sequence}:${minutesBefore}` },
      ];
    }
  );
  await enqueueJobs(executor, jobNames.bookingText, due);
}
