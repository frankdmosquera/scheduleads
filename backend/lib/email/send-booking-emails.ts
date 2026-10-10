// Backend: sends one saved booking's emails, from the business through its own Resend key: the
// customer's confirmation with the invite attached and the link to the booking's own page, the
// business's notification, and the booked person's own when they have a work email (12d.4). Each email that went gets an email_sent entry on the contact's timeline,
// with no address and no content.
// A business without its two addresses, its key or its time zone sends nothing (decision 4).

import { renderBookingConfirmation } from "../../emails/booking-confirmation.js";
import { renderBookingNotification } from "../../emails/booking-notification.js";
import { bookingPageUrl } from "../booking/booking-page-url.js";
import { bookingIcs } from "./booking-ics.js";
import { findBookingEmailContext } from "./find-booking-email-context.js";
import { findBookingEmailRecipients } from "./find-booking-email-recipients.js";
import { logNothingSent } from "./log-nothing-sent.js";
import {
  sendAndRecordEmails,
  type BookingEmailKindType,
  type BookingEmailToSendType,
} from "./send-and-record-emails.js";

// The kinds that went, in order: all, or only the one a job asks for. Throws when the booking or
// the business cannot be read, or a send fails.
export async function sendBookingEmails(
  organizationId: string,
  bookingId: string,
  only?: BookingEmailKindType
): Promise<BookingEmailKindType[]> {
  const context = await findBookingEmailContext(organizationId, bookingId);
  if (context.status !== "confirmed") return [];
  if (context.sequence > 0) return []; // moved before these went: the move's emails tell both
  const { setup } = context;
  if (!setup.ready) {
    logNothingSent(bookingId, setup.missing);
    return [];
  }
  const { facts, apiKey, from } = setup;

  const recipients = findBookingEmailRecipients({
    source: context.source,
    customerEmail: context.customerEmail,
    notifyEmail: setup.notifyEmail,
    personWorkEmail: context.personWorkEmail,
  });
  const emails: BookingEmailToSendType[] = [];
  if (recipients.customer) {
    const to = recipients.customer;
    emails.push({
      kind: "booking_confirmation",
      build: async () => ({
        ...(await renderBookingConfirmation(facts, bookingPageUrl(bookingId))),
        apiKey,
        kind: "booking_confirmation",
        from,
        to: [to],
        replyTo: recipients.customerReplyTo ?? undefined, // Reply writes to the booked person
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
              customerEmail: to,
              // The booking's own moment, so a retry sends the very same invite: Resend refuses
              // a key it already used with a different email.
              stampedAt: context.createdAt,
              sequence: 0, // the invite as made; each move sends its own, numbered higher
            }),
            contentType: "text/calendar; charset=utf-8; method=REQUEST",
          },
        ],
        idempotencyKey: `booking-confirmation/${bookingId}`,
      }),
    });
  }
  if (recipients.business) {
    const to = recipients.business;
    emails.push({
      kind: "booking_notification",
      build: async () => ({
        ...(await renderBookingNotification(facts)),
        apiKey,
        kind: "booking_notification",
        from,
        to: [to],
        replyTo: context.customerEmail ?? undefined, // pressing Reply writes to the customer
        idempotencyKey: `booking-notification/${bookingId}`,
      }),
    });
  }
  if (recipients.person) {
    const to = recipients.person;
    emails.push({
      kind: "booking_person_notification",
      build: async () => ({
        ...(await renderBookingNotification(facts)),
        apiKey,
        kind: "booking_person_notification",
        from,
        to: [to],
        replyTo: context.customerEmail ?? undefined,
        idempotencyKey: `booking-person-notification/${bookingId}`,
      }),
    });
  }

  const toSend = only ? emails.filter((email) => email.kind === only) : emails;
  return sendAndRecordEmails(organizationId, bookingId, context.contactId, toSend);
}
