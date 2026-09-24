// Backend helper: delivers a login code. Better Auth calls it through the emailOTP
// plugin in auth-server.ts. Item 6 replaces the console with real email (Resend).

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
  // Production throws on purpose: a code printed into production logs is a password in
  // plain text, and nobody would receive an email anyway.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "No email transport is configured, so the login code cannot be delivered. " +
        "Resend arrives with build-plan item 6. Until then this API cannot run in production."
    );
  }

  // Development: the code prints in the API's console. Never in an API response, or
  // anyone who knows an email address could sign in as them.
  console.log(`[auth] ${type} code for ${email}: ${otp}`);
}
