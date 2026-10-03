// Backend: tells both sides that a booking was cancelled (feature 7a): the customer's word, with an
// invite that withdraws the event from their calendar (decision 8), and the business's notice. The
// business always hears, even for a booking the owner made: the customer cancelled it. Each email
// that went gets an email_sent entry; a business that cannot send yet sends nothing.

import { and, asc, eq, sql } from "drizzle-orm";

import { activity } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { renderBookingCancelled } from "../../emails/booking-cancelled.js";
import { renderBookingCancelledNotification } from "../../emails/booking-cancelled-notification.js";
import { bookingIcs } from "./booking-ics.js";
import { findBookingEmailContext } from "./find-booking-email-context.js";
import {
  logNothingSent,
  sendAndRecordEmails,
  type BookingEmailKindType,
  type BookingEmailToSendType,
} from "./send-and-record-emails.js";

// The kinds that went, in order. Throws only when the booking or the business cannot be read.
export async function sendCancellationEmails(
  organizationId: string,
  bookingId: string
): Promise<BookingEmailKindType[]> {
  const context = await findBookingEmailContext(organizationId, bookingId);
  if (context.status !== "cancelled") return [];
  const { setup } = context;
  if (!setup.ready) {
    logNothingSent(bookingId, setup.missing);
    return [];
  }
  const { facts, apiKey, from } = setup;

  // The moment of the cancel, from its own timeline entry: a retry then sends the very same
  // invite, and Resend refuses a key it already used with a different email.
  const [cancelled] = await db
    .select({ occurredAt: activity.occurredAt })
    .from(activity)
    .where(
      and(
        eq(activity.organizationId, organizationId),
        eq(activity.type, "booking_cancelled"),
        sql`${activity.payload}->>'bookingId' = ${bookingId}`
      )
    )
    .orderBy(asc(activity.occurredAt))
    .limit(1);
  const stampedAt = cancelled?.occurredAt ?? context.createdAt;

  const emails: BookingEmailToSendType[] = [];
  const customerEmail = context.customerEmail;
  if (customerEmail) {
    emails.push({
      kind: "booking_cancellation",
      build: async () => ({
        ...(await renderBookingCancelled(facts)),
        apiKey,
        kind: "booking_cancellation",
        from,
        to: [customerEmail],
        attachments: [
          {
            filename: "invite.ics",
            content: bookingIcs({
              bookingId,
              service: facts.service,
              startsAt: facts.startsAt,
              endsAt: context.endsAt,
              location: facts.location,
              businessName: facts.business.name,
              senderEmail: setup.senderEmail,
              customerName: context.customerName,
              customerEmail,
              stampedAt,
              cancelled: true,
            }),
            contentType: "text/calendar; charset=utf-8; method=CANCEL",
          },
        ],
        idempotencyKey: `booking-cancelled/${bookingId}`,
      }),
    });
  }
  emails.push({
    kind: "booking_cancellation_notification",
    build: async () => ({
      ...(await renderBookingCancelledNotification(facts)),
      apiKey,
      kind: "booking_cancellation_notification",
      from,
      to: [setup.notifyEmail],
      replyTo: customerEmail ?? undefined, // pressing Reply writes to the customer
      idempotencyKey: `booking-cancelled-notification/${bookingId}`,
    }),
  });

  return sendAndRecordEmails(organizationId, bookingId, context.contactId, emails);
}
