// Backend: sends one saved booking's emails, from the business through its own Resend key: the
// customer's confirmation with the invite attached, and the business's notification. Each email
// that went gets an email_sent entry on the contact's timeline, with no address and no content.
// A business without its two addresses, its key or its time zone sends nothing (decision 4).

import { and, eq } from "drizzle-orm";

import { booking, bookingLink, contact, lead, resource } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { renderBookingConfirmation } from "../../emails/booking-confirmation.js";
import type { BookingEmailFactsType } from "../../emails/booking-email-facts-type.js";
import { renderBookingNotification } from "../../emails/booking-notification.js";
import { recordActivity } from "../crm/record-activity.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";
import { bookingIcs } from "./booking-ics.js";
import { findBookingEmailRecipients } from "./find-booking-email-recipients.js";
import { findBusinessEmailDetails } from "./find-business-email-details.js";
import { formatSender } from "./format-sender.js";
import { sendEmail, type SendEmailInputType } from "./send-email.js";

export type BookingEmailKindType = "booking_confirmation" | "booking_notification";

// The kinds that went, in order. Throws only when the booking or the business cannot be read.
export async function sendBookingEmails(
  organizationId: string,
  bookingId: string
): Promise<BookingEmailKindType[]> {
  const [row] = await db
    .select({
      status: booking.status,
      createdAt: booking.createdAt,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt, // the appointment itself, not its buffers
      location: booking.location,
      service: bookingLink.name,
      personName: resource.name,
      contactId: contact.id,
      customerName: contact.name,
      customerEmail: contact.email,
      phone: lead.phone, // the one given with this booking
      contactPhone: contact.phone,
      details: lead.details,
      source: lead.source,
    })
    .from(booking)
    .innerJoin(
      bookingLink,
      and(
        eq(bookingLink.organizationId, booking.organizationId),
        eq(bookingLink.id, booking.bookingLinkId)
      )
    )
    .innerJoin(
      resource,
      and(eq(resource.organizationId, booking.organizationId), eq(resource.id, booking.personId))
    )
    .innerJoin(
      lead,
      and(eq(lead.organizationId, booking.organizationId), eq(lead.id, booking.leadId))
    )
    .innerJoin(
      contact,
      and(eq(contact.organizationId, booking.organizationId), eq(contact.id, lead.contactId))
    )
    .where(and(eq(booking.organizationId, organizationId), eq(booking.id, bookingId)))
    .limit(1);
  if (!row)
    throw new Error("Sending the booking's emails failed: no such booking in this business.");
  if (row.status !== "confirmed") return [];

  const business = await findBusinessEmailDetails(organizationId);
  if (!business) throw new Error("Sending the booking's emails failed: no such business.");
  const { senderEmail, notifyEmail, apiKey, timezone } = business;
  if (!senderEmail || !notifyEmail || !apiKey || !timezone) {
    const missing = [
      !senderEmail && "sender address",
      !notifyEmail && "notification address",
      !apiKey && "Resend key",
      !timezone && "time zone",
    ].filter(Boolean);
    console.log(
      `[email] booking ${bookingId}: nothing sent, the business has no ${missing.join(", ")}`
    );
    return [];
  }

  const facts: BookingEmailFactsType = {
    business: {
      name: business.name,
      logo: business.logo,
      phone: business.phone,
      website: business.website,
      brandColor: business.brandColor,
      timezone,
    },
    service: row.service,
    startsAt: row.startsAt,
    personName: row.personName,
    location: row.location,
    customer: {
      name: row.customerName,
      email: row.customerEmail,
      phone: row.phone ?? row.contactPhone,
      details: row.details,
    },
  };
  const recipients = findBookingEmailRecipients({
    source: row.source,
    customerEmail: row.customerEmail,
    notifyEmail,
  });
  const from = formatSender(business.name, senderEmail);

  const emails: { kind: BookingEmailKindType; build: () => Promise<SendEmailInputType> }[] = [];
  if (recipients.customer) {
    const to = recipients.customer;
    emails.push({
      kind: "booking_confirmation",
      build: async () => ({
        ...(await renderBookingConfirmation(facts)),
        apiKey,
        kind: "booking_confirmation",
        from,
        to: [to],
        attachments: [
          {
            filename: "invite.ics",
            content: bookingIcs({
              bookingId,
              service: row.service,
              startsAt: row.startsAt,
              endsAt: row.endsAt,
              location: row.location,
              businessName: business.name,
              senderEmail,
              customerName: row.customerName,
              customerEmail: to,
              // The booking's own moment, so a retry sends the very same invite: Resend refuses
              // a key it already used with a different email.
              stampedAt: row.createdAt,
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
        replyTo: row.customerEmail ?? undefined, // pressing Reply writes to the customer
        idempotencyKey: `booking-notification/${bookingId}`,
      }),
    });
  }

  // Each email on its own: one failing never stops the other. Retrying is feature 8.
  const sent: BookingEmailKindType[] = [];
  const failed: string[] = [];
  for (const email of emails) {
    try {
      const resendId = await sendEmail(await email.build());
      sent.push(email.kind);
      await recordActivity(organizationId, {
        contactId: row.contactId,
        type: "email_sent",
        payload: { bookingId, kind: email.kind, resendId },
      });
    } catch (error) {
      failed.push(`${email.kind}: ${safeErrorReason(error)}`);
    }
  }
  // One line for the booking, ids and reasons only.
  if (failed.length > 0) console.warn(`[email] booking ${bookingId}: ${failed.join("; ")}`);
  return sent;
}
