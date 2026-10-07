// Backend: before a text is tried again, whether Twilio already took it (feature 8b, decision 8).
// Twilio takes no idempotency key, so a send whose answer was lost may have gone. This asks
// Twilio for the latest texts from the business's number to the customer's and looks for the
// same words since the first try. One that failed on its way is not counted: sending again is right.

import { SendTextError } from "./send-text-error.js";
import type { SendTextInputType } from "./send-text.js";
import { readTwilioAccount } from "./twilio-account.js";
import { twilioErrorCode } from "./twilio-error-code.js";

const NOT_DELIVERED = new Set(["failed", "undelivered", "canceled"]);
// Twilio's clock and ours may differ by a little. Kept well under a minute, the smallest gap
// between two of a booking's reminders, so one reminder is never taken for another.
const CLOCK_SLACK_MS = 10_000;

type TwilioMessageType = {
  sid: string;
  body: string;
  direction: string;
  status: string;
  date_created: string;
};

// Twilio's id for the text already sent, or null when there is none (or no keys: nothing was).
export async function findSentText(
  input: Omit<SendTextInputType, "kind"> & { since: Date },
  { timeoutMs = 10_000 }: { timeoutMs?: number } = {}
): Promise<string | null> {
  const account = readTwilioAccount();
  if (!account) return null;

  const query = new URLSearchParams({ From: input.from, To: input.to, PageSize: "20" }); // newest first
  let response: Response;
  try {
    response = await fetch(`${account.messagesUrl}?${query}`, {
      headers: { Authorization: account.authorization },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new SendTextError(
      timedOut ? "timeout" : "no_connection",
      null,
      true,
      "Checking for a sent text failed: no answer from Twilio."
    );
  }
  if (!response.ok) {
    const code = await twilioErrorCode(response);
    throw new SendTextError(
      code,
      response.status,
      true,
      `Checking for a sent text failed: Twilio ${code} (${response.status}).`
    );
  }

  let messages: TwilioMessageType[];
  try {
    ({ messages } = (await response.json()) as { messages: TwilioMessageType[] });
    if (!Array.isArray(messages)) throw new Error("no list");
  } catch {
    throw new SendTextError(
      "unreadable_answer",
      response.status,
      true,
      `Checking for a sent text failed: Twilio's answer (${response.status}) could not be read.`
    );
  }
  const earliest = input.since.getTime() - CLOCK_SLACK_MS;
  const sent = messages.find(
    (message) =>
      message.direction.startsWith("outbound") &&
      !NOT_DELIVERED.has(message.status) &&
      message.body === input.body &&
      Date.parse(message.date_created) >= earliest
  );
  return sent?.sid ?? null;
}
