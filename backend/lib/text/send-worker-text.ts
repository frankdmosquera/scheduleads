// Backend: sends one of the texts that keep a booked worker in the loop (feature 8c), from the
// business's own number; every worker text goes through here, so their rules cannot drift apart.
// It sends only what is still true and still news when it runs (decision 5), never to a texting
// number (decision 6), asks Twilio before a retry sends (decision 7), and records each text that
// went on the customer's timeline, with no phone number or words (decision 8).

import { recordActivity } from "../crm/record-activity.js";
import { hasWorkerTextInDoubt } from "../jobs/has-worker-text-in-doubt.js";
import { jobClock } from "../jobs/job-clock.js";
import { findSentText } from "./find-sent-text.js";
import { findTextSettings } from "./find-text-settings.js";
import { findTextingBusiness } from "./find-texting-business.js";
import { findWorkerTextsTold, type WorkerTextsToldType } from "./find-worker-texts-told.js";
import { findWorkerTextContext, type WorkerTextContextType } from "./find-worker-text-context.js";
import {
  findWorkerTextSettings,
  type WorkerTextSettingsRowType,
} from "./find-worker-text-settings.js";
import { logTextNotSent } from "./log-text-not-sent.js";
import { renderWorkerText } from "./render-worker-text.js";
import { SendTextError } from "./send-text-error.js";
import { sendText, type SendTextInputType } from "./send-text.js";

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

// Why what the person already heard makes this text wrong, or null when it is due. "New booking"
// and "moved" are not repeated once a text told them of this change or a later one; "off your day"
// goes only to someone who believes the booking is on their day.
function whyNotNews(
  text: WorkerTextType,
  told: WorkerTextsToldType,
  believes: boolean
): string | null {
  if (text.kind === "removed") {
    if (believes) return null;
    return told.onTheirDay.length > 0
      ? "the person was already told it is off their day"
      : "the person never knew of this booking";
  }
  return told.onTheirDay.some((sequence) => sequence >= text.sequence)
    ? "the person was already told after this change"
    : null;
}

// Whether the booking left the person a "new booking" or "moved" text was for, so an "off your
// day" may follow it.
const leftThePerson = (text: WorkerTextType, context: WorkerTextContextType) =>
  text.kind !== "removed" && (context.status !== "confirmed" || context.personId !== text.personId);

// The text as it goes to the person, from the business's number.
function workerMessage(
  text: WorkerTextType,
  context: WorkerTextContextType & { timezone: string },
  from: string,
  to: string
): SendTextInputType {
  const startsAt = text.kind === "removed" ? text.startsAt : context.startsAt;
  return {
    kind: `worker_${text.kind}`,
    from,
    to,
    body: renderWorkerText(text.kind, { ...context, startsAt, timezone: context.timezone }),
  };
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
  // `sequence`: the least the text told them. Sent now, the booking as it is; found on a retry,
  // the change it was sent for: it went at some earlier try, about this change or a later one.
  const record = (twilioSid: string | null, sequence: number) =>
    recordActivity(organizationId, {
      contactId: context.contactId,
      type: "sms_sent",
      payload: { bookingId, kind, personId: text.personId, sequence, twilioSid },
    });
  // On a retry, whether an earlier try already went; recorded when it did.
  const foundEarlier = async (message: SendTextInputType) => {
    if (attempt === 1) return false;
    const sent = await findSentText({ ...message, since: text.changedAt });
    if (sent) await record(sent, text.sequence);
    return sent !== null;
  };

  const notDue = whyNotDue(text, context, jobClock.now());
  if (notDue) {
    // An earlier try that went is recorded even so: the "off your day" after it reads the entry,
    // since this job, the only other sign it may have reached them, ends here.
    if (attempt > 1 && leftThePerson(text, context)) {
      const [worker, settings] = await Promise.all([
        findWorkerTextSettings(organizationId, text.personId),
        findTextSettings(organizationId),
      ]);
      const { timezone } = context;
      if (worker && settings && timezone) {
        const message = workerMessage(
          text,
          { ...context, timezone },
          settings.fromNumber,
          worker.phone
        );
        if (await foundEarlier(message)) return;
      }
    }
    return notSent(notDue);
  }

  const worker = await findWorkerTextSettings(organizationId, text.personId);
  if (!worker) return notSent("the person has no worker text settings");
  // Someone turned off still hears about the bookings they hold: off only stops new ones (12d).
  if (!worker[SWITCH_OF[text.kind]]) return notSent("the person has that text off");
  const { contactId } = context;
  const told = await findWorkerTextsTold({
    organizationId,
    contactId,
    bookingId,
    personId: text.personId,
  });
  // Believes it is on their day: their latest text about it said so (newer than any "off your
  // day"), one tried may have reached them, or with "new booking" texts off they learn elsewhere.
  const latestOff = Math.max(-1, ...told.offTheirDay);
  const believes =
    text.kind === "removed" &&
    (told.onTheirDay.some((sequence) => sequence > latestOff) ||
      !worker.addedOn ||
      (await hasWorkerTextInDoubt(bookingId, text.personId)));
  const notNews = whyNotNews(text, told, believes);
  if (notNews) return notSent(notNews);
  const settings = await findTextSettings(organizationId);
  if (!settings) return notSent("the business has no text settings");
  if (!context.timezone) return notSent("the business has no time zone");
  if (await findTextingBusiness(worker.phone)) {
    return notSent("the person's phone is a texting number");
  }

  const message = workerMessage(
    text,
    { ...context, timezone: context.timezone },
    settings.fromNumber,
    worker.phone
  );
  if (await foundEarlier(message)) return;

  let twilioSid: string | null;
  try {
    twilioSid = await sendText(message);
  } catch (error) {
    if (error instanceof SendTextError && !error.retry) return notSent(`Twilio ${error.code}`);
    throw error;
  }
  await record(twilioSid, context.sequence);
}
