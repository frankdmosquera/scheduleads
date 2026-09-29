// Backend: everything that happens when Google sends the browser back, reduced to one of
// five outcomes the dashboard shows in plain words. Nothing is saved unless every check
// passes; tokens Google already issued are handed back before giving up.

import { and, eq } from "drizzle-orm";

import { resource } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { googleOAuthClient } from "./google-oauth-client.js";
import { saveCalendarConnection } from "./save-calendar-connection.js";
import { useOauthTicket } from "./use-oauth-ticket.js";

export type ConnectOutcomeType =
  | "connected"
  | "denied" // pressed Cancel at Google
  | "expired" // no ticket, stale, used, someone else's, or signed out
  | "missing_permission" // a permission box unticked
  | "failed"; // Google did not answer usefully

export async function finishGoogleConnect({
  userId,
  state,
  code,
  error,
}: {
  userId: string | null; // null when the browser came back signed out
  state: string | undefined;
  code: string | undefined;
  error: string | undefined;
}): Promise<ConnectOutcomeType> {
  // Used up first, whatever else Google said, so a ticket never outlives its trip.
  const ticket = userId && state ? await useOauthTicket(state, userId) : null;

  if (error) return error === "access_denied" ? "denied" : "failed";
  if (!ticket || !userId) return "expired";
  if (!code) return "failed";

  // The person may have been unlinked from this login in the ten minutes at Google.
  const [person] = await db
    .select({ id: resource.id })
    .from(resource)
    .where(
      and(
        eq(resource.id, ticket.resourceId),
        eq(resource.organizationId, ticket.organizationId),
        eq(resource.userId, userId)
      )
    )
    .limit(1);
  if (!person) return "expired";

  const tokens = await googleOAuthClient
    .exchangeCode({ code, codeVerifier: ticket.codeVerifier })
    .catch(() => null);
  if (!tokens) return "failed";

  const handBack = () => googleOAuthClient.revoke(tokens.refreshToken ?? tokens.accessToken);

  if (!googleOAuthClient.hasBothCalendarScopes(tokens.grantedScopes)) {
    await handBack();
    return "missing_permission";
  }

  const identity = googleOAuthClient.readIdentity(tokens.idToken);
  if (!tokens.refreshToken || !identity) {
    await handBack(); // without a refresh token nothing could be read tomorrow
    return "failed";
  }

  try {
    await saveCalendarConnection({
      organizationId: ticket.organizationId,
      resourceId: ticket.resourceId,
      accountEmail: identity.email,
      grantedScopes: tokens.grantedScopes,
      credentials: {
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
      },
    });
  } catch {
    await handBack(); // not saved, so Google should not keep the permission either
    return "failed";
  }

  return "connected";
}
