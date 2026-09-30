// Backend: everything that happens when Google sends the browser back, reduced to one of
// five outcomes the dashboard shows in plain words. Nothing is saved unless every check
// passes; tokens Google already issued are handed back before giving up.

import { and, eq } from "drizzle-orm";

import type { CalendarConnectOutcomeType } from "@scheduleads-app/shared/calendar";
import { calendarConnection, resource } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { googleOauthClient } from "./google-oauth-client.js";
import { handBackCalendarPermission } from "./hand-back-calendar-permission.js";
import { isCalendarAccountInUse } from "./is-calendar-account-in-use.js";
import { saveCalendarConnection } from "./save-calendar-connection.js";
import { redeemOauthTicket } from "./redeem-oauth-ticket.js";
import { warnConnectFailed } from "./warn-connect-failed.js";

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
}): Promise<CalendarConnectOutcomeType> {
  // Used up first, whatever else Google said, so a ticket never outlives its trip.
  const ticket = userId && state ? await redeemOauthTicket(state, userId) : null;

  if (error === "access_denied") return "denied";
  if (error) {
    warnConnectFailed("google", /^[a-z_]+$/.test(error) ? new Error(error) : undefined);
    return "failed";
  }
  if (!ticket || !userId) return "expired";
  if (!code) {
    warnConnectFailed("google", new Error("no code in the return address"));
    return "failed";
  }

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

  const tokens = await googleOauthClient
    .exchangeCode({ code, codeVerifier: ticket.codeVerifier })
    .catch((swapError: unknown) => {
      warnConnectFailed("the code swap", swapError);
      return null;
    });
  if (!tokens) return "failed";

  const identity = googleOauthClient.readIdentity(tokens.idToken);

  // Giving up hands the new tokens back, unless that Gmail is connected anywhere, this
  // person's own working connection included: it is one permission at Google, so handing
  // it back would cancel that connection too. An unreadable sign-in token names no Gmail.
  const handBack = async () => {
    if (
      identity &&
      (await isCalendarAccountInUse({ provider: "google", accountEmail: identity.email }))
    ) {
      return;
    }
    await googleOauthClient.revoke(tokens.refreshToken ?? tokens.accessToken);
  };

  if (!googleOauthClient.hasBothCalendarScopes(tokens.grantedScopes)) {
    await handBack();
    return "missing_permission";
  }

  if (!tokens.refreshToken || !identity) {
    await handBack(); // without a refresh token nothing could be read tomorrow
    const why = tokens.refreshToken
      ? "the sign-in token was not ours, not Google's, or unverified"
      : "no refresh token";
    warnConnectFailed("the token check", new Error(why));
    return "failed";
  }

  // A reconnect replaces this row, so the old account is read before the save.
  const [previous] = await db
    .select({
      provider: calendarConnection.provider,
      accountEmail: calendarConnection.accountEmail,
      credentials: calendarConnection.credentials,
    })
    .from(calendarConnection)
    .where(
      and(
        eq(calendarConnection.organizationId, ticket.organizationId),
        eq(calendarConnection.resourceId, ticket.resourceId)
      )
    )
    .limit(1);

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
  } catch (saveError) {
    await handBack(); // not saved, so Google should not keep the permission either
    warnConnectFailed("the save", saveError);
    return "failed";
  }

  // Switched to another Google account: the old one's permission goes back, after the new
  // one is safely saved. The same account is one permission at Google, so it is left alone.
  if (previous && previous.accountEmail.toLowerCase() !== identity.email.toLowerCase()) {
    const oldAccount = await handBackCalendarPermission({
      provider: previous.provider,
      accountEmail: previous.accountEmail,
      lockedCredentials: previous.credentials,
      resourceId: ticket.resourceId,
    }).catch(() => "not_confirmed" as const);
    if (oldAccount === "not_confirmed") {
      console.warn("[calendar] a reconnect with another account could not hand the old one back");
    }
  }

  return "connected";
}
