// Backend: the one door every text goes out through (feature 8b), so moving WhatsApp to Meta later
// changes only this file. Twilio's Messages API by plain fetch with the agency's keys (decision
// 5), from the business's own number. Nothing about the text reaches a log line: no number, no
// words.

import { SendTextError } from "./send-text-error.js";
import { readTwilioAccount } from "./twilio-account.js";
import { twilioErrorCode } from "./twilio-error-code.js";

// Refusals no retry can change (decision 7): a number that is not one, a country the account
// cannot text, a customer who texted STOP, a number no carrier can text, a landline.
const NEVER_RETRY = new Set(["21211", "21408", "21610", "21612", "21614"]);

export type SendTextInputType = {
  kind: string; // for the log line only: "booking_confirmation", ...
  from: string; // the business's number, "+14035550199"
  to: string; // "+14035550148", from textablePhoneNumber
  body: string;
};

// Twilio's id for the text, or null when nothing was sent (development without keys). The time
// limit is a parameter only so a test need not wait ten seconds.
export async function sendText(
  input: SendTextInputType,
  { timeoutMs = 10_000 }: { timeoutMs?: number } = {}
): Promise<string | null> {
  const account = readTwilioAccount();
  if (!account) {
    if (process.env.NODE_ENV === "production") {
      throw new SendTextError(
        "no_keys",
        null,
        true,
        `Sending a text failed: no Twilio keys for ${input.kind}.`
      );
    }
    console.log(`[text] ${input.kind} not sent, no Twilio keys in development`);
    return null;
  }

  let response: Response;
  try {
    response = await fetch(account.messagesUrl, {
      method: "POST",
      headers: {
        Authorization: account.authorization,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: input.from, To: input.to, Body: input.body }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    // No answer is not a refusal: the text may still have gone, so a retry checks first (decision 8).
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new SendTextError(
        "timeout",
        null,
        true,
        `Sending a text failed: no answer from Twilio within ${timeoutMs / 1000} seconds.`
      );
    }
    throw new SendTextError(
      "no_connection",
      null,
      true,
      "Sending a text failed: Twilio could not be reached."
    );
  }

  if (response.ok) {
    const { sid } = (await response.json()) as { sid: string };
    return sid;
  }
  const code = await twilioErrorCode(response);
  throw new SendTextError(
    code,
    response.status,
    !NEVER_RETRY.has(code),
    `Sending a text failed: Twilio ${code} (${response.status}).`
  );
}
