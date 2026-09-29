// Backend: the conversation with Google's sign-in service, in plain fetch: the consent
// address, swapping the code for tokens, and handing tokens back. No Google package: its
// main job, holding tokens in memory and refreshing them, does not fit tokens stored
// locked per person.

import { apiOrigin } from "../auth/auth-server.js";

const CONSENT_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const TIMEOUT_MS = 10_000; // a Google that hangs ends in "failed", not a spinning dashboard

// Both are required for a connection to count. freebusy reads busy times; events.owned
// adds bookings to calendars the person owns (feature 5). The narrowest pair Google offers.
const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events.freebusy",
  "https://www.googleapis.com/auth/calendar.events.owned",
];

export type GoogleTokensType = {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string | null; // null when Google sent none: the caller treats that as failed
  grantedScopes: string[];
  idToken: string | null;
};

export type GoogleIdentityType = { email: string };

function settings() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be set. They come from the OAuth " +
        "client in Google Cloud (Google Auth Platform, Clients); see .env.example."
    );
  }
  return { clientId, clientSecret, redirectUri: `${apiOrigin}/calendar/callback` };
}

export const googleOauthClient = {
  // server.ts calls this at start, so a missing value stops the API, not someone's Connect.
  assertConfigured(): void {
    settings();
  },

  consentUrl({ state, codeChallenge }: { state: string; codeChallenge: string }): string {
    const { clientId, redirectUri } = settings();
    const url = new URL(CONSENT_URL);
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: ["openid", "email", ...CALENDAR_SCOPES].join(" "),
      access_type: "offline", // a long-lived refresh token, so busy times can be read later
      prompt: "consent", // asks every time, so Google sends a refresh token every time
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    }).toString();
    return url.toString();
  },

  hasBothCalendarScopes(grantedScopes: string[]): boolean {
    return CALENDAR_SCOPES.every((scope) => grantedScopes.includes(scope));
  },

  // Throws on any answer but a usable token set; the callback turns that into "failed".
  async exchangeCode({
    code,
    codeVerifier,
  }: {
    code: string;
    codeVerifier: string;
  }): Promise<GoogleTokensType> {
    const { clientId, clientSecret, redirectUri } = settings();
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        code_verifier: codeVerifier,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      // Google's own word for why (invalid_client: the secret; redirect_uri_mismatch: the
      // address). Only a plain code word is kept, never the free-text description.
      const refusal = (await response.json().catch(() => ({}))) as { error?: unknown };
      const why = typeof refusal.error === "string" && /^[a-z_]+$/.test(refusal.error);
      throw new Error(
        `Google refused the code swap (${response.status}${why ? ` ${refusal.error}` : ""}).`
      );
    }

    const body = (await response.json()) as Record<string, unknown>;
    if (typeof body.access_token !== "string" || typeof body.expires_in !== "number") {
      throw new Error("Google's token answer had no access token.");
    }

    return {
      accessToken: body.access_token,
      accessTokenExpiresAt: new Date(Date.now() + body.expires_in * 1000),
      refreshToken: typeof body.refresh_token === "string" ? body.refresh_token : null,
      grantedScopes: typeof body.scope === "string" ? body.scope.split(" ") : [],
      idToken: typeof body.id_token === "string" ? body.id_token : null,
    };
  },

  // The Gmail from the sign-in token. It came straight from Google's token endpoint over
  // HTTPS, so its signature needs no check (OpenID Connect Core 1.0, 3.1.3.7); the audience
  // and issuer still must be ours and Google's, and the address must be verified.
  readIdentity(idToken: string | null): GoogleIdentityType | null {
    const payloadPart = idToken?.split(".")[1];
    if (!payloadPart) return null;

    try {
      const claims = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
      const fromGoogle = ["accounts.google.com", "https://accounts.google.com"].includes(
        claims.iss
      );
      const forUs = claims.aud === settings().clientId;
      if (!fromGoogle || !forUs || claims.email_verified !== true) return null;
      return typeof claims.email === "string" ? { email: claims.email } : null;
    } catch {
      return null; // not a readable token
    }
  },

  // Hands a token back so Google forgets the permission. Best effort: returns whether Google
  // confirmed, never throws, because it only runs on the way out of a failed connect.
  async revoke(token: string): Promise<boolean> {
    try {
      const response = await fetch(REVOKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      return response.ok;
    } catch {
      return false;
    }
  },
};
