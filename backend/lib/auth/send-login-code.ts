// Backend helper: delivers a login code. Better Auth calls it through the emailOTP plugin in
// auth-server.ts. It goes out through the one email door from the agency's address (decision 7);
// in development without the settings it prints to the console instead.

import { createHash } from "node:crypto";

import type { DashboardLanguageType } from "@scheduleads-app/shared/pick-dashboard-language";

import { readEmailSettings } from "../email/read-email-settings.js";
import { sendEmail } from "../email/send-email.js";
import { loginCodeWordsOf } from "./login-code-words.js";

export type LoginCodeType = "sign-in" | "email-verification" | "forget-password";

export async function sendLoginCode({
  email,
  otp,
  type,
  languageOf,
}: {
  email: string;
  otp: string;
  type: LoginCodeType | string;
  // Asked only when an email goes out, so the printed code below stays immediate.
  languageOf: () => Promise<DashboardLanguageType>;
}): Promise<void> {
  const { agencyApiKey, loginFrom } = readEmailSettings(); // production without them throws here

  // Development without the settings: the code prints in the API's console. Never in an API
  // response, or anyone who knows an email address could sign in as them.
  if (!agencyApiKey || !loginFrom) {
    console.log(`[auth] ${type} code for ${email}: ${otp}`);
    return;
  }

  const words = loginCodeWordsOf[await languageOf()];

  // The same code asked for twice sends one email. Hashed, so the key carries neither.
  const idempotencyKey = `login-code/${createHash("sha256").update(`${email}:${otp}`).digest("hex").slice(0, 32)}`;
  await sendEmail({
    apiKey: agencyApiKey,
    kind: "login_code",
    from: loginFrom,
    to: [email],
    subject: words.subject(otp),
    text: words.text(otp),
    html: `<p>${words.codeIs} <strong style="font-size:20px;letter-spacing:2px">${otp}</strong>.</p><p>${words.worksFor}</p><p style="color:#64748b">${words.ignoreIt}</p>`,
    idempotencyKey,
  });
}
