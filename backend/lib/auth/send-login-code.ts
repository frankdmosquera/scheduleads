// Backend helper: delivers a login code. Better Auth calls it through the emailOTP plugin in
// auth-server.ts. It goes out through the one email door from the agency's address (decision 7);
// in development without the settings it prints to the console instead.

import { createHash } from "node:crypto";

import { readEmailSettings } from "../email/read-email-settings.js";
import { sendEmail } from "../email/send-email.js";

export type LoginCodeType = "sign-in" | "email-verification" | "forget-password";

export async function sendLoginCode({
  email,
  otp,
  type,
}: {
  email: string;
  otp: string;
  type: LoginCodeType | string;
}): Promise<void> {
  const { agencyApiKey, loginFrom } = readEmailSettings(); // production without them throws here

  // Development without the settings: the code prints in the API's console. Never in an API
  // response, or anyone who knows an email address could sign in as them.
  if (!agencyApiKey || !loginFrom) {
    console.log(`[auth] ${type} code for ${email}: ${otp}`);
    return;
  }

  // The same code asked for twice sends one email. Hashed, so the key carries neither.
  const idempotencyKey = `login-code/${createHash("sha256").update(`${email}:${otp}`).digest("hex").slice(0, 32)}`;
  await sendEmail({
    apiKey: agencyApiKey,
    kind: "login_code",
    from: loginFrom,
    to: [email],
    subject: `Your sign-in code: ${otp}`,
    text: `Your sign-in code is ${otp}. It works for 5 minutes.\n\nIf you did not ask for it, ignore this email.`,
    html: `<p>Your sign-in code is <strong style="font-size:20px;letter-spacing:2px">${otp}</strong>.</p><p>It works for 5 minutes.</p><p style="color:#64748b">If you did not ask for it, ignore this email.</p>`,
    idempotencyKey,
  });
}
