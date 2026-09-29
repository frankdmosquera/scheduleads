// Backend: uses a ticket up, in one statement. Only a fresh ticket of this login comes
// back; unknown, expired, used or someone else's gives null. One DELETE, so two returns
// from Google with the same state cannot both succeed.

import { and, eq, gt } from "drizzle-orm";

import { calendarOauthState } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { oauthStateFingerprint } from "./oauth-state-fingerprint.js";

export type UsedOauthTicketType = {
  organizationId: string;
  resourceId: string;
  codeVerifier: string;
};

export async function useOauthTicket(
  state: string,
  userId: string
): Promise<UsedOauthTicketType | null> {
  const [ticket] = await db
    .delete(calendarOauthState)
    .where(
      and(
        eq(calendarOauthState.id, oauthStateFingerprint(state)),
        eq(calendarOauthState.userId, userId), // someone else's ticket is not touched
        gt(calendarOauthState.expiresAt, new Date())
      )
    )
    .returning({
      organizationId: calendarOauthState.organizationId,
      resourceId: calendarOauthState.resourceId,
      codeVerifier: calendarOauthState.codeVerifier,
    });

  return ticket ?? null;
}
