// Backend: the job that passes one customer's text reply on to the business (feature 8b). Ids
// only in its payload: the words are read back from Twilio when it runs. A failure throws, so the
// runner tries again.

import { passOnReply } from "../text/pass-on-reply.js";
import { jobTask } from "./job-task.js";

export type TextReplyJobPayloadType = { organizationId: string; messageSid: string };

export const textReplyJob = jobTask(async (payload) => {
  const { organizationId, messageSid } = payload as TextReplyJobPayloadType;
  await passOnReply(organizationId, messageSid);
});
