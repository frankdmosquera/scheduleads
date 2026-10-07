// Backend: passes a customer's text reply on to the business, where its settings say (feature 8b,
// decision 9): to its reply email, its reply phone, or both. Ids and reasons in the log, never a
// number or the words.

import { and, eq, isNull, lt, or, sql } from "drizzle-orm";

import { textReply } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
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

// How long a run's claim on the text holds: far past the send's own 10 seconds, so a second run
// never sends while the first is still waiting on Twilio.
const CLAIM_SECONDS = 60;

const notPassedOn = (messageSid: string, reason: string) =>
  console.log(`[text] reply ${messageSid}: not passed on, ${reason}`);

const ofThisReply = (messageSid: string) => eq(textReply.messageSid, messageSid);

// The text's claim, taken atomically: only one run sends at a time. The time of an earlier claim
// whose run never said how it went (a lost answer) comes back too, so this run asks Twilio first.
async function claimText(messageSid: string): Promise<{ claimed: boolean; earlier: Date | null }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ triedAt: textReply.textTriedAt, sentAt: textReply.textSentAt })
      .from(textReply)
      .where(ofThisReply(messageSid))
      .for("update");
    if (!row || row.sentAt) return { claimed: false, earlier: null };
    const claimed = await tx
      .update(textReply)
      .set({ textTriedAt: sql`now()` })
      .where(
        and(
          ofThisReply(messageSid),
          or(
            isNull(textReply.textTriedAt),
            lt(textReply.textTriedAt, sql`now() - make_interval(secs => ${CLAIM_SECONDS})`)
          )
        )
      )
      .returning({ messageSid: textReply.messageSid });
    return { claimed: claimed.length > 0, earlier: row.triedAt };
  });
}

// A failure throws, so the runner tries again: both ways are tried on every run first, so one
// that keeps failing never holds back the other.
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

  await db.insert(textReply).values({ messageSid, organizationId }).onConflictDoNothing();
  const [record] = await db
    .select()
    .from(textReply)
    .where(and(ofThisReply(messageSid), eq(textReply.organizationId, organizationId)));
  if (!record) return notPassedOn(messageSid, "its record belongs to another business");

  const senderName = await findReplySenderName(organizationId, message.from);
  const failures: unknown[] = [];
  let goesSomewhere = false;

  if (settings.replyEmail) {
    const business = await findBusinessEmailDetails(organizationId);
    if (!business?.senderEmail || !business.apiKey) {
      notPassedOn(messageSid, "the business has no email sending, so not by email");
    } else {
      goesSomewhere = true;
      if (!record.emailSentAt) {
        try {
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
          await db
            .update(textReply)
            .set({ emailSentAt: sql`now()` })
            .where(ofThisReply(messageSid));
        } catch (error) {
          failures.push(error);
        }
      }
    }
  }

  // Never to a business's texting number: that hands the words to another business, or two
  // businesses drop each other's replies.
  if (settings.replyPhone && (await findTextingBusiness(settings.replyPhone))) {
    notPassedOn(messageSid, "the reply phone is a texting number, so not as a text");
  } else if (settings.replyPhone && !record.textSentAt) {
    goesSomewhere = true;
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
    const claim = await claimText(messageSid);
    if (!claim.claimed) {
      // Another run holds the claim, still sending or lost mid-send: try again once it lapses.
      failures.push(new Error(`Passing on reply ${messageSid} by text: another run holds it.`));
    } else {
      try {
        // An earlier run's send may have gone with its answer lost: Twilio is asked first, for
        // this text since that run's claim, so another reply in the same words is never this one.
        const already = claim.earlier
          ? await findSentText({ ...text, since: claim.earlier })
          : null;
        if (!already) await sendText(text);
        await db
          .update(textReply)
          .set({ textSentAt: sql`now()` })
          .where(ofThisReply(messageSid));
      } catch (error) {
        if (error instanceof SendTextError && !error.retry) {
          notPassedOn(messageSid, `Twilio ${error.code} for the reply phone`);
        } else {
          // Refused by Twilio, so surely not sent: the claim is let go for the next try. With no
          // answer at all it stays, and the next run asks Twilio once it lapses.
          if (error instanceof SendTextError && error.status !== null) {
            await db.update(textReply).set({ textTriedAt: null }).where(ofThisReply(messageSid));
          }
          failures.push(error);
        }
      }
    }
  } else if (settings.replyPhone) {
    goesSomewhere = true; // already passed on by an earlier run
  }

  if (!goesSomewhere) notPassedOn(messageSid, "nowhere it can go");
  if (failures.length > 0) throw failures[0];
}
