// Backend: sends a booking's emails one by one and records each that went as an email_sent entry
// on the contact's timeline: the booking, which email, Resend's id, never an address or content.
// One failing never stops the next; then any failure is thrown, ids and reasons only, so the job
// that sent them is tried again. A retry reuses each email's key, never a second email.

import { recordActivity } from "../crm/record-activity.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";
import { sendEmail, type SendEmailInputType } from "./send-email.js";

export type BookingEmailKindType =
  | "booking_confirmation"
  | "booking_notification"
  | "booking_person_notification"
  | "booking_move"
  | "booking_move_notification"
  | "booking_cancellation"
  | "booking_cancellation_notification";

export type BookingEmailToSendType = {
  kind: BookingEmailKindType;
  build: () => Promise<SendEmailInputType>; // rendered only when its turn comes
};

// The kinds that went, in order.
export async function sendAndRecordEmails(
  organizationId: string,
  bookingId: string,
  contactId: string,
  emails: BookingEmailToSendType[]
): Promise<BookingEmailKindType[]> {
  const sent: BookingEmailKindType[] = [];
  const failed: string[] = [];
  for (const email of emails) {
    try {
      const resendId = await sendEmail(await email.build());
      sent.push(email.kind);
      await recordActivity(organizationId, {
        contactId,
        type: "email_sent",
        payload: { bookingId, kind: email.kind, resendId },
      });
    } catch (error) {
      failed.push(`${email.kind}: ${safeErrorReason(error)}`);
    }
  }
  if (failed.length > 0) throw new Error(`booking ${bookingId}: ${failed.join("; ")}`);
  return sent;
}
