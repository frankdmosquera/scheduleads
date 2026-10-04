// Backend: tells both sides that a booking moved (feature 7b, decision 8): the customer's word, with
// the invite updated to the new time under a higher number, and the business's notice. The
// business always hears; the customer when they gave an email. Each email that went gets an
// email_sent entry; a business that cannot send yet sends nothing. One move, one email each: the
// keys carry the move's number.

import { and, asc, eq, sql } from "drizzle-orm";

import { activity } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { renderBookingMoved } from "../../emails/booking-moved.js";
import { renderBookingMovedNotification } from "../../emails/booking-moved-notification.js";
import { bookingPageUrl } from "../booking/booking-page-url.js";
import { bookingIcs } from "./booking-ics.js";
import { findBookingEmailContext } from "./find-booking-email-context.js";
import { logNothingSent } from "./log-nothing-sent.js";
import {
  sendAndRecordEmails,
  type BookingEmailKindType,
  type BookingEmailToSendType,
} from "./send-and-record-emails.js";

// The kinds that went, in order, for the move that gave the booking this sequence. Throws when the
// booking, the business or that move cannot be read.
export async function sendMoveEmails(
  organizationId: string,
  bookingId: string,
  sequence: number
): Promise<BookingEmailKindType[]> {
  const context = await findBookingEmailContext(organizationId, bookingId);
  if (context.status !== "confirmed") return []; // cancelled since: the cancellation says so
  const { setup } = context;
  if (!setup.ready) {
    logNothingSent(bookingId, setup.missing);
    return [];
  }
  const { facts, apiKey, from } = setup;

  // The move itself, from its own timeline entry: its times, even after a later move, and its
  // moment, so a retry sends the very same invite and Resend accepts the key again.
  const [moved] = await db
    .select({ occurredAt: activity.occurredAt, payload: activity.payload })
    .from(activity)
    .where(
      and(
        eq(activity.organizationId, organizationId),
        eq(activity.contactId, context.contactId), // the timeline index, and only this customer's
        eq(activity.type, "booking_moved"),
        sql`${activity.payload}->>'bookingId' = ${bookingId}`,
        sql`${activity.payload}->>'sequence' = ${String(sequence)}`
      )
    )
    .orderBy(asc(activity.occurredAt))
    .limit(1);
  if (!moved) throw new Error(`Sending a move's emails failed: no move ${sequence} was saved.`);
  const { fromStartsAt, toStartsAt } = moved.payload as {
    fromStartsAt: string;
    toStartsAt: string;
  };
  const startsAt = new Date(toStartsAt);
  const movedFrom = new Date(fromStartsAt);
  // The same service throughout, so the same length as the booking's current times.
  const endsAt = new Date(
    startsAt.getTime() + (context.endsAt.getTime() - facts.startsAt.getTime())
  );
  const movedFacts = { ...facts, startsAt };

  const emails: BookingEmailToSendType[] = [];
  const customerEmail = context.customerEmail;
  if (customerEmail) {
    emails.push({
      kind: "booking_move",
      build: async () => ({
        ...(await renderBookingMoved(movedFacts, movedFrom, bookingPageUrl(bookingId))),
        apiKey,
        kind: "booking_move",
        from,
        to: [customerEmail],
        attachments: [
          {
            filename: "invite.ics",
            content: bookingIcs({
              bookingId,
              service: facts.service,
              startsAt,
              endsAt,
              location: facts.location,
              businessName: facts.business.name,
              senderEmail: setup.senderEmail,
              customerName: context.customerName,
              customerEmail,
              stampedAt: moved.occurredAt ?? context.createdAt,
              sequence,
            }),
            contentType: "text/calendar; charset=utf-8; method=REQUEST",
          },
        ],
        idempotencyKey: `booking-moved/${bookingId}/${sequence}`,
      }),
    });
  }
  emails.push({
    kind: "booking_move_notification",
    build: async () => ({
      ...(await renderBookingMovedNotification(movedFacts, movedFrom)),
      apiKey,
      kind: "booking_move_notification",
      from,
      to: [setup.notifyEmail],
      replyTo: customerEmail ?? undefined, // pressing Reply writes to the customer
      idempotencyKey: `booking-moved-notification/${bookingId}/${sequence}`,
    }),
  });

  return sendAndRecordEmails(organizationId, bookingId, context.contactId, emails);
}
