// Backend: the job that sends one of a booking's emails (decision 2). It reads the booking afresh
// when it runs (decision 3): a booking that is gone sends nothing, and nothing goes once the
// appointment has started (decision 4). A send that fails throws, so the runner tries again
// under the same Resend key.

import { and, eq } from "drizzle-orm";

import { booking } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import type { BookingEmailKindType } from "../email/send-and-record-emails.js";
import { sendBookingEmails } from "../email/send-booking-emails.js";
import { sendCancellationEmails } from "../email/send-cancellation-emails.js";
import { sendMoveEmails } from "../email/send-move-emails.js";
import { jobClock } from "./job-clock.js";
import { jobTask } from "./job-task.js";

// Ids only, never a customer's details. `sequence` is the move's number, for the move's emails.
export type BookingEmailJobPayloadType = {
  organizationId: string;
  bookingId: string;
  kind: BookingEmailKindType;
  sequence: number;
};

export const bookingEmailJob = jobTask(async (payload) => {
  const { organizationId, bookingId, kind, sequence } = payload as BookingEmailJobPayloadType;
  const [row] = await db
    .select({ startsAt: booking.startsAt })
    .from(booking)
    .where(and(eq(booking.organizationId, organizationId), eq(booking.id, bookingId)));
  if (!row) return; // the booking, or its business, was removed: no one to tell
  if (row.startsAt.getTime() <= jobClock.now().getTime()) {
    console.warn(`[email] booking ${bookingId}: ${kind} not sent, the appointment has started`);
    return;
  }

  if (kind === "booking_confirmation" || kind === "booking_notification") {
    await sendBookingEmails(organizationId, bookingId, kind);
  } else if (kind === "booking_cancellation" || kind === "booking_cancellation_notification") {
    await sendCancellationEmails(organizationId, bookingId, kind);
  } else {
    await sendMoveEmails(organizationId, bookingId, sequence, kind);
  }
});
