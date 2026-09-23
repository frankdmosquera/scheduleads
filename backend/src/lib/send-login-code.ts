/**
 * The one place a login code leaves the process.
 *
 * Item 6 owns transactional email and swaps Resend in here. Until then
 * there is no transport, and the two honest ways to behave differ by
 * environment:
 *
 * - Outside production the code goes to the server console, so sign-in
 *   works on a laptop with no mail provider configured.
 * - In production it throws. A login code printed into a production log
 *   is a password sitting in plain text in a place many people can read,
 *   and a log line is not a delivered email. Failing loudly is the only
 *   version of this that is not a lie to the person waiting for a code.
 *
 * In neither case is the code returned in an API response. That would
 * hand anyone who knows an email address a way in.
 */

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
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "No email transport is configured, so the login code cannot be delivered. " +
        "Resend arrives with build-plan item 6. Until then this API cannot run in production."
    );
  }

  console.log(`[auth] ${type} code for ${email}: ${otp}`);
}
