// Backend: the one-time ticket for a trip to Google and back. The state value only ever
// travels in Google's address; the database keeps its SHA-256, so a copy of the table
// cannot finish anyone's connect. Lives ten minutes, used up once (use-oauth-ticket.ts).

import { createHash, randomBytes } from "node:crypto";

import { and, eq, lt } from "drizzle-orm";

import { calendarOauthState } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { oauthStateFingerprint } from "./oauth-state-fingerprint.js";

const TICKET_MINUTES = 10;

export type OauthTicketType = { state: string; codeChallenge: string };

export async function createOauthTicket({
  userId,
  organizationId,
  resourceId,
}: {
  userId: string;
  organizationId: string;
  resourceId: string;
}): Promise<OauthTicketType> {
  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url"); // PKCE: 43 characters, as the spec asks
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  // Your expired tickets go, so the table never grows with abandoned trips to Google.
  await db
    .delete(calendarOauthState)
    .where(
      and(eq(calendarOauthState.userId, userId), lt(calendarOauthState.expiresAt, new Date()))
    );

  await db.insert(calendarOauthState).values({
    id: oauthStateFingerprint(state),
    userId,
    organizationId,
    resourceId,
    codeVerifier,
    expiresAt: new Date(Date.now() + TICKET_MINUTES * 60_000),
  });

  return { state, codeChallenge };
}
