// Backend: the one door every email goes out through. It sends through Resend with the key it is
// given: the business's own for its emails (decision 6), the agency's for login codes (decision
// 7). The same idempotency key never sends twice. Nothing about the email reaches a log line.

import { Resend } from "resend";

export type SendEmailInputType = {
  apiKey: string | null; // null only in development without a key: nothing is sent
  kind: string; // for the log line only: "login_code", "booking_confirmation", ...
  from: string; // "Primo Painters <bookings@primopainters.com>"
  to: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: string; contentType: string }[]; // content as text
  idempotencyKey: string; // never a code, an address or anything the customer typed
};

// Resend's id for the email, or null when nothing was sent (development without a key). The time
// limit is a parameter only so a test need not wait ten seconds.
export async function sendEmail(
  input: SendEmailInputType,
  { timeoutMs = 10_000 }: { timeoutMs?: number } = {}
): Promise<string | null> {
  if (!input.apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Sending an email failed: no Resend key for ${input.kind}.`);
    }
    console.log(
      `[email] ${input.kind} not sent, no Resend key in development (${input.idempotencyKey})`
    );
    return null;
  }

  const signal = AbortSignal.timeout(timeoutMs);
  // Resend answers failures in { error } instead of throwing, a lost connection included.
  const { data, error } = await new Resend(input.apiKey).emails.send(
    {
      from: input.from,
      to: input.to,
      replyTo: input.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: Buffer.from(attachment.content, "utf8").toString("base64"), // Resend reads base64
        contentType: attachment.contentType,
      })),
    },
    { idempotencyKey: input.idempotencyKey, signal }
  );
  if (signal.aborted) {
    throw new Error(
      `Sending an email failed: no answer from Resend within ${timeoutMs / 1000} seconds.`
    );
  }
  // Only the error's name and status: Resend's message can repeat the addresses it was given.
  if (error) {
    const status = error.statusCode ? ` (${error.statusCode})` : "";
    throw new Error(`Sending an email failed: ${error.name}${status}.`);
  }
  return data.id;
}
