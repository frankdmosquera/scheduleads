// Backend: hands a person's calendar permission back to the provider, best effort. The
// provider keeps one permission per account for our app, so while another connection
// still uses the same account it is kept: handing it back would cut that one off too.

import { decryptCredentials, readTokenKey } from "@scheduleads-app/shared/crypto";

import { findCalendarProvider } from "./find-calendar-provider.js";
import { isCalendarAccountInUse } from "./is-calendar-account-in-use.js";
import type { CalendarCredentialsType } from "./save-calendar-connection.js";

export type CalendarHandBackResultType =
  | "handed_back" // the provider confirmed
  | "not_confirmed" // the provider did not answer, or our copy of the keys could not be opened
  | "still_used"; // another connection uses the same account, so the permission stays

export async function handBackCalendarPermission({
  provider,
  accountEmail,
  lockedCredentials,
  resourceId, // the person the keys are sealed to; their own row is not "another connection"
}: {
  provider: string;
  accountEmail: string;
  lockedCredentials: string;
  resourceId: string;
}): Promise<CalendarHandBackResultType> {
  if (await isCalendarAccountInUse({ provider, accountEmail, exceptResourceId: resourceId })) {
    return "still_used";
  }

  let credentials: CalendarCredentialsType;
  try {
    credentials = JSON.parse(decryptCredentials(lockedCredentials, readTokenKey(), resourceId));
  } catch {
    return "not_confirmed"; // keys we cannot open cannot be handed back
  }

  const confirmed = await findCalendarProvider(provider).revoke(credentials.refreshToken);
  return confirmed ? "handed_back" : "not_confirmed";
}
