// Backend: what one business's emails need, read inside that business only: its name, logo,
// colour, phone, website and time zone, the two addresses, and its own Resend key unlocked.
// Backend only: the key goes from here to sendEmail and nowhere else (decision 6).

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule, emailSendingKey, organization } from "@scheduleads-app/shared/db";
import { decryptCredentials, readTokenKey } from "@scheduleads-app/shared/crypto";

import { db } from "../../database.js";

export type BusinessEmailDetailsType = {
  name: string;
  logo: string | null;
  senderEmail: string | null;
  notifyEmail: string | null;
  phone: string | null;
  website: string | null;
  brandColor: string | null;
  timezone: string | null; // from the business's bookable hours; null before it has any
  apiKey: string | null; // its own Resend key, or null when none is saved
};

export async function findBusinessEmailDetails(
  organizationId: string
): Promise<BusinessEmailDetailsType | null> {
  const [row] = await db
    .select({
      name: organization.name,
      logo: organization.logo,
      senderEmail: organization.senderEmail,
      notifyEmail: organization.notifyEmail,
      phone: organization.phone,
      website: organization.website,
      brandColor: organization.brandColor,
      timezone: availabilityRule.timezone,
      credentials: emailSendingKey.credentials,
    })
    .from(organization)
    .leftJoin(
      availabilityRule,
      and(eq(availabilityRule.organizationId, organization.id), isNull(availabilityRule.resourceId))
    )
    .leftJoin(emailSendingKey, eq(emailSendingKey.organizationId, organization.id))
    .where(eq(organization.id, organizationId))
    .limit(1);
  if (!row) return null;

  const { credentials, ...details } = row;
  const apiKey = credentials
    ? decryptCredentials(credentials, readTokenKey(), organizationId)
    : null;
  return { ...details, apiKey };
}
