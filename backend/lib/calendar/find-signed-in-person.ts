// Backend: "you" on the calendar. The person in the active business linked to the
// session's login, or null when the login has no person there.

import { and, eq } from "drizzle-orm";

import { resource } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export type SignedInPersonType = { id: string; name: string };

export async function findSignedInPerson(
  organizationId: string, // from the session, never from the request
  userId: string
): Promise<SignedInPersonType | null> {
  const [person] = await db
    .select({ id: resource.id, name: resource.name })
    .from(resource)
    .where(
      and(
        eq(resource.organizationId, organizationId),
        eq(resource.userId, userId),
        eq(resource.kind, "person")
      )
    )
    .limit(1); // the database allows one login at most one person per business

  return person ?? null;
}
