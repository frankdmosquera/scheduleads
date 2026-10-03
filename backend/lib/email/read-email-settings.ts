// Backend: the agency's own email settings, for login codes (decision 7). RESEND_API_KEY is the
// agency's Resend account, LOGIN_EMAIL_FROM the address codes come from. Production refuses to
// start without both: codes with nowhere to go would lock every owner out. Called by server.ts at
// start, and by the login code on every send.

export type EmailSettingsType = {
  agencyApiKey: string | null;
  loginFrom: string | null; // "Agency name <login@agency.com>" or a bare address
};

export function readEmailSettings(env: NodeJS.ProcessEnv = process.env): EmailSettingsType {
  const agencyApiKey = env.RESEND_API_KEY?.trim() || null;
  const loginFrom = env.LOGIN_EMAIL_FROM?.trim() || null;

  const address = loginFrom?.match(/<([^<>]+)>$/)?.[1] ?? loginFrom; // the address inside "Name <...>"
  if (address && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) {
    throw new Error('LOGIN_EMAIL_FROM must be an address, or "Name <address>".');
  }
  if (env.NODE_ENV === "production" && (!agencyApiKey || !loginFrom)) {
    throw new Error(
      "RESEND_API_KEY and LOGIN_EMAIL_FROM must both be set in production: without them no login " +
        "code can be sent and nobody can sign in."
    );
  }
  return { agencyApiKey, loginFrom };
}
