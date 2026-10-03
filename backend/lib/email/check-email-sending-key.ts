// Backend: proves a business's own Resend key works before anything keeps it, by sending one
// test email with it, from the business's address to its notification address. A refusal is
// answered in plain words for the form; the key itself never reaches an answer or a log.

import { randomUUID } from "node:crypto";

import { SendEmailError } from "./send-email-error.js";
import { sendEmail } from "./send-email.js";

export type CheckEmailSendingKeyInputType = {
  apiKey: string;
  businessName: string;
  senderEmail: string; // the address at the business's verified domain
  notifyEmail: string; // where the test email lands
};

export type CheckEmailSendingKeyResultType = { ok: true } | { ok: false; reason: string };

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Resend's answers, in words an owner can act on.
function reasonFor(error: SendEmailError): string {
  if (error.status === 401 || error.code.endsWith("api_key")) return "Resend refused this key.";
  if (error.status === 403) {
    return (
      "Resend would not send from this address. Check that its domain is verified in the same " +
      "Resend account, and that the key may send from it."
    );
  }
  return "Resend could not send the test email just now. Try again shortly.";
}

export async function checkEmailSendingKey(
  input: CheckEmailSendingKeyInputType
): Promise<CheckEmailSendingKeyResultType> {
  try {
    await sendEmail({
      apiKey: input.apiKey,
      kind: "email_key_check",
      from: `${input.businessName} <${input.senderEmail}>`,
      to: [input.notifyEmail],
      subject: "Your booking emails are set up",
      text: `This test email shows that ${input.businessName}'s booking emails can be sent. Nothing else to do.`,
      html: `<p>This test email shows that ${escapeHtml(input.businessName)}'s booking emails can be sent.</p><p>Nothing else to do.</p>`,
      idempotencyKey: `email-key-check/${randomUUID()}`, // each check is its own email
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof SendEmailError) return { ok: false, reason: reasonFor(error) };
    throw error;
  }
}
