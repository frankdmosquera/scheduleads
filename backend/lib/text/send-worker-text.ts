// Backend: sends one of the texts that keep a booked worker in the loop (feature 8c), from the
// business's own number; every worker text goes through here, so their rules cannot drift apart.
// It does what is still true when it runs (decision 5):
// - "new booking" and "moved" go while the booking is confirmed, not started and still theirs,
//   a "moved" only if no later move replaced it, and neither when they already heard of this
//   change (a text about the booking at or past this change's move number reached them, F-242).
// - "off your day" goes while they are off the booking and the time they had has not passed, and
//   only if they knew of it: a "new booking" or "moved" text reached them, or their "new booking"
//   switch is off and they learn of bookings elsewhere.
// A person without the settings, inactive or with that text off, or a business without texts or a
// time zone sends nothing, in one log line. A phone that is any business's texting number is
// never texted (decision 6): it would arrive there as a customer's reply. On a retry it first asks
// Twilio whether the text already went since the change was saved (decision 7). Each text that
// went is an sms_sent entry on the customer's timeline, with the person and the booking's move
// number it described, and no phone number or words (decision 8).

import { recordActivity } from "../crm/record-activity.js";
import { jobClock } from "../jobs/job-clock.js";
import { findSentText } from "./find-sent-text.js";
import { findTextSettings } from "./find-text-settings.js";
import { findTextingBusiness } from "./find-texting-business.js";
import { findWorkerNewsTold } from "./find-worker-news-told.js";
import { findWorkerTextContext, type WorkerTextContextType } from "./find-worker-text-context.js";
import {
  findWorkerTextSettings,
  type WorkerTextSettingsRowType,
} from "./find-worker-text-settings.js";
import { logTextNotSent } from "./log-text-not-sent.js";
import { renderWorkerText } from "./render-worker-text.js";
import { SendTextError } from "./send-text-error.js";
import { sendText } from "./send-text.js";

type WorkerTextChangeType = {
  personId: string; // who is told
  sequence: number; // the booking's move number when the change was saved
  changedAt: Date; // when the change was saved: the retry check looks no earlier
};

export type WorkerTextType = WorkerTextChangeType &
  ({ kind: "added" | "moved" } | { kind: "removed"; startsAt: Date }); // the time they had

const SWITCH_OF = {
  added: "addedOn",
  moved: "movedOn",
  removed: "removedOn",
} as const satisfies Record<WorkerTextType["kind"], keyof WorkerTextSettingsRowType>;

// Why the booking itself no longer calls for this text, or null when it still does.
function whyNotDue(text: WorkerTextType, context: WorkerTextContextType, now: Date): string | null {
  if (text.kind === "removed") {
    if (context.status === "confirmed" && context.personId === text.personId) {
      return "the booking is this person's again";
    }
    return text.startsAt.getTime() <= now.getTime() ? "the time they had has passed" : null;
  }
  if (context.status !== "confirmed") return "the booking was cancelled";
  if (context.personId !== text.personId) return "the booking is another person's now";
  if (context.startsAt.getTime() <= now.getTime()) return "the appointment has started";
  if (text.kind === "moved" && context.sequence > text.sequence) {
    return "a later move replaced it";
  }
  return null;
}

// Why what the person already heard makes this text wrong, or null when it is due.
function whyNotNews(
  text: WorkerTextType,
  worker: WorkerTextSettingsRowType,
  told: number[]
): string | null {
  if (text.kind === "removed") {
    return told.length > 0 || !worker.addedOn ? null : "the person never knew of this booking";
  }
  return told.some((sequence) => sequence >= text.sequence)
    ? "the person was already told after this change"
    : null;
}

// `attempt` is the runner's try number: 1 the first time.
export async function sendWorkerText(
  organizationId: string,
  bookingId: string,
  text: WorkerTextType,
  attempt: number
): Promise<void> {
  const kind = `worker_${text.kind}`;
  const context = await findWorkerTextContext(organizationId, bookingId);
  if (!context) return; // the booking, or its business, was removed: no one to tell
  const notSent = (reason: string) => logTextNotSent(bookingId, kind, reason);
  const notDue = whyNotDue(text, context, jobClock.now());
  if (notDue) return notSent(notDue);

  const worker = await findWorkerTextSettings(organizationId, text.personId);
  if (!worker) return notSent("the person has no worker text settings");
  if (!worker.active) return notSent("the person is inactive");
  if (!worker[SWITCH_OF[text.kind]]) return notSent("the person has that text off");
  const { contactId } = context;
  const told = await findWorkerNewsTold({
    organizationId,
    contactId,
    bookingId,
    personId: text.personId,
  });
  const notNews = whyNotNews(text, worker, told);
  if (notNews) return notSent(notNews);
  const settings = await findTextSettings(organizationId);
  if (!settings) return notSent("the business has no text settings");
  if (!context.timezone) return notSent("the business has no time zone");
  if (await findTextingBusiness(worker.phone)) {
    return notSent("the person's phone is a texting number");
  }

  const startsAt = text.kind === "removed" ? text.startsAt : context.startsAt;
  const message = {
    kind,
    from: settings.fromNumber,
    to: worker.phone,
    body: renderWorkerText(text.kind, { ...context, startsAt, timezone: context.timezone }),
  };
  const record = (twilioSid: string | null) =>
    recordActivity(organizationId, {
      contactId,
      type: "sms_sent",
      payload: {
        bookingId,
        kind,
        personId: text.personId,
        sequence: context.sequence, // the booking as this text described it
        twilioSid,
      },
    });

  if (attempt > 1) {
    const sent = await findSentText({ ...message, since: text.changedAt });
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
