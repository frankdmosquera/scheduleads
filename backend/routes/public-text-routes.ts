// Backend: where Twilio posts every text a customer sends to a business's number (feature 8b,
// decision 9). No login: only a post carrying Twilio's valid signature for this exact address is
// taken, so no one else can make a reply appear. It answers Twilio at once with an empty reply and
// leaves the passing on to a job, keyed by the text's id, so Twilio posting the same text twice
// passes it on once. A text to a number no business has is answered and dropped.

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
const MESSAGE_SID = /^(SM|MM)[0-9a-f]{32}$/;
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
    const signedFor = `${apiOrigin}/texts/incoming`;
    if (
      !account ||
      !verifyTwilioSignature(
        signedFor,
        fields,
        c.req.header("X-Twilio-Signature"),
        account.authToken
      )
    ) {
      return c.text("Not from Twilio.", 403);
    }

    const answer = () => c.body(EMPTY_REPLY, 200, { "Content-Type": "text/xml" });
    const messageSid = fields.MessageSid ?? "";
    const organizationId = await findTextingBusiness(fields.To ?? "");
    if (!organizationId || !MESSAGE_SID.test(messageSid)) {
      console.log("[text] a reply to a number no business texts from, dropped");
      return answer();
    }

    const payload: TextReplyJobPayloadType = { organizationId, messageSid };
    await enqueueJob(db, jobNames.textReply, payload, { jobKey: `text-reply/${messageSid}` });
    return answer();
  }
);
