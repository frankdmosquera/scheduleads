// Backend: adds the jobs for the texts a booking or a move owes (feature 8b), inside that change's
// own transaction (8a, decision 1): a new booking's confirmation, and one reminder for each of the
// business's reminders at that moment, due at the appointment minus its minutes. A reminder whose
// moment has already passed is never added. Each job decides when it runs whether its text still
// goes.

import type { DatabaseExecutorType } from "../../database-executor-type.js";
import { findTextSettings } from "../text/find-text-settings.js";
import type { BookingTextJobPayloadType } from "./booking-text-job.js";
import { enqueueJob } from "./enqueue-job.js";
import { jobNames } from "./job-names.js";

const MINUTE_MS = 60_000;

export type BookingTextsOwedType = {
  organizationId: string;
  bookingId: string;
  sequence: number; // 0 when made, the move's number after a move
  startsAt: Date;
  now: Date;
  confirmation: boolean; // a new booking's; a move sends none
};

export async function enqueueBookingTexts(
  executor: DatabaseExecutorType,
  owed: BookingTextsOwedType
): Promise<void> {
  const { organizationId, bookingId, sequence, startsAt, now } = owed;
  const ids = { organizationId, bookingId, sequence };

  // Added whatever the settings say now: the job reads them when it runs.
  if (owed.confirmation) {
    const confirmation: BookingTextJobPayloadType = {
      ...ids,
      kind: "confirmation",
      minutesBefore: null,
    };
    await enqueueJob(executor, jobNames.bookingText, confirmation);
  }

  const settings = await findTextSettings(organizationId, executor);
  for (const minutesBefore of settings?.reminderMinutesBefore ?? []) {
    const runAt = new Date(startsAt.getTime() - minutesBefore * MINUTE_MS);
    if (runAt.getTime() <= now.getTime()) continue;
    const reminder: BookingTextJobPayloadType = { ...ids, kind: "reminder", minutesBefore };
    await enqueueJob(executor, jobNames.bookingText, reminder, { runAt });
  }
}
