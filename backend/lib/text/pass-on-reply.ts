// Backend: passes a customer's text reply on to the business, where its settings say (feature 8b,
// decision 9): to its reply email, its reply phone, or both. Ids and reasons in the log, never a
// number or the words.

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

// A failure throws, so the runner tries again; the email keeps its key and the text is checked
// with Twilio first, so neither is passed on twice.
export async function passOnReply(organizationId: string, messageSid: string): Promise<void> {
  const settings = await findTextSettings(organizationId);
  if (!settings) return notPassedOn(messageSid, "the business has no text settings");
  const message = await readTwilioMessage(messageSid);
  if (!message) return notPassedOn(messageSid, "no Twilio keys to read it");
  if (message.to !== settings.fromNumber) {
    return notPassedOn(messageSid, "it was sent to another number"); // never another business's
  }
  if (message.from === settings.replyPhone) {
    // The business answering into its texting number: passing it on would only bounce it back.
    return notPassedOn(messageSid, "it came from the business's own reply phone");
  }

  const senderName = await findReplySenderName(organizationId, message.from);
  let passedOn = false;

  // The email first, so a text that keeps failing can never hold it back: a reply is never lost
  // while one way to the business works.
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
        hasPicture: message.hasPicture,
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

  if (settings.replyPhone) {
    // Never to a business's texting number: that hands the words to another business, or two
    // businesses drop each other's replies.
    if (await findTextingBusiness(settings.replyPhone)) {
      notPassedOn(messageSid, "the reply phone is a texting number, so not as a text");
    } else {
      const text = {
        kind: "text_reply",
        from: settings.fromNumber,
        to: settings.replyPhone,
        body: renderReplyText({
          senderName,
          number: message.from,
          words: message.body,
          hasPicture: message.hasPicture,
        }),
      };
      // Checked on every run, not only a retry: Twilio posting the reply again starts a fresh job.
      if (await findSentText({ ...text, since: message.receivedAt })) {
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

  if (!passedOn) notPassedOn(messageSid, "nowhere it can go");
}
