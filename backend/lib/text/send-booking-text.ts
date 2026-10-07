// Backend: sends one of a booking's texts, the confirmation or a reminder, from the business's own
// number (feature 8b); both go through here, so their rules cannot drift apart. It does what is
// still true when it runs (decision 6): a cancelled booking, a started appointment, a business
// without texts or with that text off, or a customer without a phone that takes texts sends
// nothing, in one log line. The confirmation of a booking moved before it went says the new time;
// a reminder a later move replaced stays quiet, the move added its own. On a retry it first asks
// Twilio whether the text already went (decision 8). A refusal no retry can change is logged; any
// other failure throws, so the runner tries again. Each text that went is an sms_sent entry on the
// contact's timeline, with no number and no words.

import { textablePhoneNumber } from "@scheduleads-app/shared/textable-phone-number";

import { bookingPageUrl } from "../booking/booking-page-url.js";
import { recordActivity } from "../crm/record-activity.js";
import { jobClock } from "../jobs/job-clock.js";
import {
  findBookingTextContext,
  type BookingTextContextType,
} from "./find-booking-text-context.js";
import { findSentText } from "./find-sent-text.js";
import { findTextSettings, type TextSettingsRowType } from "./find-text-settings.js";
import { logTextNotSent } from "./log-text-not-sent.js";
import { renderConfirmationText } from "./render-confirmation-text.js";
import { renderReminderText } from "./render-reminder-text.js";
import { SendTextError } from "./send-text-error.js";
import { sendText } from "./send-text.js";

export type BookingTextType =
  { kind: "confirmation" } | { kind: "reminder"; sequence: number; minutesBefore: number };

const MINUTE_MS = 60_000;

// Why this text no longer goes, or null when it still does.
function whyNotDue(
  text: BookingTextType,
  context: BookingTextContextType,
  settings: TextSettingsRowType
): string | null {
  if (text.kind === "confirmation") {
    return settings.confirmationOn ? null : "the business has the confirmation text off";
  }
  if (context.sequence > text.sequence) return "a later move replaced it";
  return settings.reminderMinutesBefore.includes(text.minutesBefore)
    ? null
    : "the business no longer has that reminder";
}

// `attempt` is the runner's try number: 1 the first time.
export async function sendBookingText(
  organizationId: string,
  bookingId: string,
  text: BookingTextType,
  attempt: number
): Promise<void> {
  const kind = text.kind === "confirmation" ? "booking_confirmation" : "booking_reminder";
  const context = await findBookingTextContext(organizationId, bookingId);
  if (!context) return; // the booking, or its business, was removed: no one to tell
  const notSent = (reason: string) => logTextNotSent(bookingId, kind, reason);
  if (context.status !== "confirmed") return notSent("the booking was cancelled");
  if (context.startsAt.getTime() <= jobClock.now().getTime()) {
    return notSent("the appointment has started");
  }

  const settings = await findTextSettings(organizationId);
  if (!settings) return notSent("the business has no text settings");
  const why = whyNotDue(text, context, settings);
  if (why) return notSent(why);
  if (!context.timezone) return notSent("the business has no time zone");
  const to = textablePhoneNumber(context.phone);
  if (!to) return notSent("no phone that takes texts");

  const facts = {
    businessName: context.businessName,
    startsAt: context.startsAt,
    timezone: context.timezone,
    bookingPageUrl: bookingPageUrl(bookingId),
  };
  const message = {
    kind,
    from: settings.fromNumber,
    to,
    body: text.kind === "confirmation" ? renderConfirmationText(facts) : renderReminderText(facts),
  };
  const record = (twilioSid: string | null) =>
    recordActivity(organizationId, {
      contactId: context.contactId,
      type: "sms_sent",
      payload:
        text.kind === "confirmation"
          ? { bookingId, kind, twilioSid }
          : { bookingId, kind, minutesBefore: text.minutesBefore, twilioSid },
    });

  if (attempt > 1) {
    // Its first try came after the booking was made, for the confirmation, or at its own time, for
    // a reminder: so a booking's earlier reminder, in the same words, is never taken for this one.
    const since =
      text.kind === "confirmation"
        ? context.createdAt
        : new Date(context.startsAt.getTime() - text.minutesBefore * MINUTE_MS);
    const sent = await findSentText({ ...message, since });
    if (sent) {
      await record(sent);
      return;
    }
  }

  let twilioSid: string | null;
  try {
    twilioSid = await sendText(message);
  } catch (error) {
    if (error instanceof SendTextError && !error.retry) return notSent(`Twilio ${error.code}`);
    throw error;
  }
  await record(twilioSid);
}
