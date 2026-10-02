// Backend: locks a person's Google tokens and writes their connection. A reconnect
// replaces the row, so a person never has two.

import { randomUUID } from "node:crypto";

import { calendarConnection } from "@scheduleads-app/shared/db";
import { encryptCredentials, readTokenKey } from "@scheduleads-app/shared/crypto";

import { db } from "../../database.js";

export type CalendarCredentialsType = {
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: string; // ISO 8601
};

export async function saveCalendarConnection({
  organizationId,
  resourceId,
  accountEmail,
  grantedScopes,
  credentials,
}: {
  organizationId: string;
  resourceId: string;
  accountEmail: string;
  grantedScopes: string[];
  credentials: CalendarCredentialsType;
}): Promise<void> {
  // Sealed to the person, so the value cannot be moved onto another person's row and read.
  const locked = encryptCredentials(JSON.stringify(credentials), readTokenKey(), resourceId);
  const fields = {
    provider: "google",
    accountEmail,
    credentials: locked,
    grantedScopes: grantedScopes.join(" "),
    status: "connected",
    lastCheckedAt: null, // nothing read yet with these tokens (getBusyTimes sets it)
  };

  await db
    .insert(calendarConnection)
    .values({ id: randomUUID(), organizationId, resourceId, ...fields })
    .onConflictDoUpdate({
      target: calendarConnection.resourceId,
      set: { ...fields, updatedAt: new Date() },
    });
}
