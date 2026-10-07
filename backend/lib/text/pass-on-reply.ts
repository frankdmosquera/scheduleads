// Backend: passes a customer's text reply on to the business, where its settings say (feature 8b,
// decision 9): as a text from its own number to its reply phone, as an email through its own
// sender to its reply email, or both. Never a text from the reply phone itself, which would only
// bounce the business's own words back to it, and never to any business's texting number, which
// would hand the words to another business or drop them (F-199): then only the email goes. Ids
// and reasons in the log, never a number or the words. A failure throws, so the runner tries
// again; on a retry the text is checked with Twilio first and the email keeps its key, so neither
// is passed on twice.

import { renderTextReplyNotification } from "../../emails/text-reply-notification.js";
import { findBusinessEmailDetails } from "../email/find-business-email-details.js";
import { formatSender } from "../email/format-sender.js";
import { sendEmail } from "../email/send-email.js";
import { findReplySenderName } from "./find-reply-sender-name.js";
import { findSentText } from "./find-sent-text.js";
import { findTextSettings } from "./find-text-settings.js";
import { findTextingBusiness } from "./find-texting-business.js";
import { readablePhoneNumber } from "./readable-phone-number.js";
import { readTwilioMessage } from "./read-twilio-message.js";
import { renderReplyText } from "./render-reply-text.js";
import { SendTextError } from "./send-text-error.js";
import { sendText } from "./send-text.js";

const notPassedOn = (messageSid: string, reason: string) =>
  console.log(`[text] reply ${messageSid}: not passed on, ${reason}`);

// `attempt` is the runner's try number: 1 the first time.
export async function passOnReply(
  organizationId: string,
  messageSid: string,
  attempt: number
): Promise<void> {
  const settings = await findTextSettings(organizationId);
  if (!settings) return notPassedOn(messageSid, "the business has no text settings");
  const message = await readTwilioMessage(messageSid);
  if (!message) return notPassedOn(messageSid, "no Twilio keys to read it");
  if (message.to !== settings.fromNumber) {
    return notPassedOn(messageSid, "it was sent to another number");
  }
  if (message.from === settings.replyPhone) {
    return notPassedOn(messageSid, "it came from the business's own reply phone");
  }

  const senderName = await findReplySenderName(organizationId, message.from);
  let passedOn = false;

  if (settings.replyPhone) {
    if (await findTextingBusiness(settings.replyPhone)) {
      notPassedOn(messageSid, "the reply phone is a texting number, so not as a text");
    } else {
      const text = {
        kind: "text_reply",
        from: settings.fromNumber,
        to: settings.replyPhone,
        body: renderReplyText(senderName, message.from, message.body),
      };
      const already =
        attempt > 1 ? await findSentText({ ...text, since: message.receivedAt }) : null;
      if (already) {
        passedOn = true;
      } else {
        try {
          await sendText(text);
          passedOn = true;
        } catch (error) {
          if (!(error instanceof SendTextError && !error.retry)) throw error;
          notPassedOn(messageSid, `Twilio ${error.code} for the reply phone`);
        }
      }
    }
  }

  if (settings.replyEmail) {
    const business = await findBusinessEmailDetails(organizationId);
    if (!business?.senderEmail || !business.apiKey) {
      notPassedOn(messageSid, "the business has no email sending, so not by email");
    } else {
      const email = await renderTextReplyNotification({
        business: { name: business.name, logo: business.logo, brandColor: business.brandColor },
        senderName,
        number: readablePhoneNumber(message.from),
        words: message.body,
      });
      await sendEmail({
        ...email,
        apiKey: business.apiKey,
        kind: "text_reply",
        from: formatSender(business.name, business.senderEmail),
        to: [settings.replyEmail],
        idempotencyKey: `text-reply/${messageSid}`, // a retry is the same email
      });
      passedOn = true;
    }
  }

  if (!passedOn) notPassedOn(messageSid, "nowhere it can go");
}
