// Backend: where Twilio posts every text a customer sends to a business's number (feature 8b,
// decision 9). No login: only a post Twilio signed for this exact address is taken.

import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import { db } from "../database.js";
import { apiOrigin } from "../lib/auth/auth-server.js";
import { enqueueJob } from "../lib/jobs/enqueue-job.js";
import { jobNames } from "../lib/jobs/job-names.js";
import type { TextReplyJobPayloadType } from "../lib/jobs/text-reply-job.js";
import { findTextingBusiness } from "../lib/text/find-texting-business.js";
import { readTwilioAccount } from "../lib/text/twilio-account.js";
import { verifyTwilioSignature } from "../lib/text/verify-twilio-signature.js";

const MOST_BYTES = 64 * 1024; // a text is at most 1600 characters; Twilio's other fields are small
const MESSAGE_SID = /^(SM|MM)[0-9a-fA-F]{32}$/;
const EMPTY_REPLY = '<?xml version="1.0" encoding="UTF-8"?><Response/>'; // Twilio sends nothing back

export const publicTextRoutes = new Hono().post(
  "/incoming",
  bodyLimit({ maxSize: MOST_BYTES, onError: (c) => c.text("Too large.", 413) }),
  async (c) => {
    const account = readTwilioAccount();
    const form = await c.req.parseBody();
    const fields = Object.fromEntries(
      Object.entries(form).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    );
    // Twilio signs the address its webhook is set to: it must be exactly this one, or every reply
    // is refused here, so a refusal is logged (ids only) where a wrong address would show.
    const signedFor = `${apiOrigin}/texts/incoming`;
    const signature = c.req.header("X-Twilio-Signature");
    if (!account || !verifyTwilioSignature(signedFor, fields, signature, account.authToken)) {
      console.warn(`[text] a post to ${signedFor} refused: not signed by Twilio for it`);
      return c.text("Not from Twilio.", 403);
    }

    const answer = () => c.body(EMPTY_REPLY, 200, { "Content-Type": "text/xml" });
    const messageSid = fields.MessageSid ?? "";
    if (!MESSAGE_SID.test(messageSid)) {
      console.warn("[text] a reply without a message id Twilio uses, dropped");
      return answer();
    }
    const organizationId = await findTextingBusiness(fields.To ?? "");
    if (!organizationId) {
      console.log(`[text] reply ${messageSid}: to a number no business texts from, dropped`);
      return answer();
    }

    // The words stay with Twilio; the job reads them back by the id. Keyed by it, so Twilio
    // posting the same text again while it waits adds no second job.
    const payload: TextReplyJobPayloadType = { organizationId, messageSid };
    await enqueueJob(db, jobNames.textReply, payload, { jobKey: `text-reply/${messageSid}` });
    return answer();
  }
);
