// Backend: sends one of the texts that keep a booked worker in the loop (feature 8c), from the
// business's own number; every worker text goes through here, so their rules cannot drift apart.
// It does what is still true when it runs (decision 5): a booking cancelled, started or no longer
// this person's, a person without the settings, inactive or with that text off, or a business
// without texts or a time zone sends nothing, in one log line. A phone that is any business's
// texting number is never texted (decision 6): it would arrive there as a customer's reply. On a
// retry it first asks Twilio whether the text already went since the change was saved (decision
// 7). Each text that went is an sms_sent entry on the customer's timeline, with the person and no
// number or words (decision 8).

import { recordActivity } from "../crm/record-activity.js";
import { jobClock } from "../jobs/job-clock.js";
import { findSentText } from "./find-sent-text.js";
import { findTextSettings } from "./find-text-settings.js";
import { findTextingBusiness } from "./find-texting-business.js";
import { findWorkerTextContext } from "./find-worker-text-context.js";
import { findWorkerTextSettings } from "./find-worker-text-settings.js";
import { logTextNotSent } from "./log-text-not-sent.js";
import { renderWorkerText, type WorkerTextKindType } from "./render-worker-text.js";
import { SendTextError } from "./send-text-error.js";
import { sendText } from "./send-text.js";

export type WorkerTextType = {
  kind: WorkerTextKindType;
  personId: string; // who is told
  changedAt: Date; // when the change was saved: the retry check looks no earlier
};

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
  if (context.status !== "confirmed") return notSent("the booking was cancelled");
  if (context.personId !== text.personId) return notSent("the booking is another person's now");
  if (context.startsAt.getTime() <= jobClock.now().getTime()) {
    return notSent("the appointment has started");
  }

  const worker = await findWorkerTextSettings(organizationId, text.personId);
  if (!worker) return notSent("the person has no worker text settings");
  if (!worker.active) return notSent("the person is inactive");
  if (!worker.addedOn) return notSent("the person has that text off");
  const settings = await findTextSettings(organizationId);
  if (!settings) return notSent("the business has no text settings");
  if (!context.timezone) return notSent("the business has no time zone");
  if (await findTextingBusiness(worker.phone)) {
    return notSent("the person's phone is a texting number");
  }

  const message = {
    kind,
    from: settings.fromNumber,
    to: worker.phone,
    body: renderWorkerText(text.kind, { ...context, timezone: context.timezone }),
  };
  const record = (twilioSid: string | null) =>
    recordActivity(organizationId, {
      contactId: context.contactId,
      type: "sms_sent",
      payload: { bookingId, kind, personId: text.personId, twilioSid },
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
