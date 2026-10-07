// Backend: one text as Twilio keeps it, read by its id (feature 8b): who sent it, to which number,
// the words and when it arrived. A reply's job holds only the id; this is where the words come
// from when it runs. A failure throws a SendTextError, retried, naming no number and no words.

import { SendTextError } from "./send-text-error.js";
import { readTwilioAccount } from "./twilio-account.js";
import { twilioErrorCode } from "./twilio-error-code.js";

export type IncomingTextType = {
  from: string;
  to: string;
  body: string;
  hasPicture: boolean; // a picture or file came with it; only the words are passed on
  receivedAt: Date;
};

type TwilioAnswerType = {
  from?: unknown;
  to?: unknown;
  body?: unknown;
  num_media?: unknown; // Twilio gives it as text, "0" or "1"
  date_created?: unknown;
};

// Null without Twilio keys: there is no account to read from.
export async function readTwilioMessage(
  messageSid: string,
  { timeoutMs = 10_000 }: { timeoutMs?: number } = {}
): Promise<IncomingTextType | null> {
  const account = readTwilioAccount();
  if (!account) return null;

  const url = account.messagesUrl.replace(/\.json$/, `/${encodeURIComponent(messageSid)}.json`);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: account.authorization },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new SendTextError(
      timedOut ? "timeout" : "no_connection",
      null,
      true,
      "Reading a text failed: no answer from Twilio."
    );
  }
  if (!response.ok) {
    const code = await twilioErrorCode(response);
    throw new SendTextError(
      code,
      response.status,
      true,
      `Reading a text failed: Twilio ${code} (${response.status}).`
    );
  }

  let answer: TwilioAnswerType;
  try {
    answer = (await response.json()) as TwilioAnswerType;
  } catch {
    answer = {};
  }
  const { from, to, body, num_media: numMedia, date_created: dateCreated } = answer;
  if (typeof from !== "string" || typeof to !== "string" || typeof body !== "string") {
    throw new SendTextError(
      "unreadable_answer",
      response.status,
      true,
      `Reading a text failed: Twilio's answer (${response.status}) could not be read.`
    );
  }
  const receivedAt = new Date(typeof dateCreated === "string" ? dateCreated : Number.NaN);
  return {
    from,
    to,
    body,
    hasPicture: Number(numMedia) > 0,
    receivedAt: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
  };
}
