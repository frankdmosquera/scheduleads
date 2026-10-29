// Backend: what one business's emails need, read inside that business only: its name, logo,
// colour, phone, website and time zone, the two saved addresses, and its owner's login email,
// where its notices go when it saved none (feature 25a). Its emails go through the agency's key.

import { and, asc, eq, isNull } from "drizzle-orm";

import { availabilityRule, member, organization, user } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export type BusinessEmailDetailsType = {
  name: string;
  logo: string | null;
  senderEmail: string | null; // its own saved sender, or null for the one picked for it
  notifyEmail: string | null;
  ownerEmail: string | null; // the first owner's login email, or null when it has no owner
  phone: string | null;
  website: string | null;
  brandColor: string | null;
  brandInk: string | null; // its look's own text on brandColor (feature 25f)
  timezone: string | null; // from the business's bookable hours; null before it has any
  language: "en" | "es"; // its owner's emails are written in it
  currency: string | null; // its prices' (feature 25d); null: no price is written
};

export async function findBusinessEmailDetails(
  organizationId: string
): Promise<BusinessEmailDetailsType | null> {
  const [[row], [owner]] = await Promise.all([
    db
      .select({
        name: organization.name,
        logo: organization.logo,
        senderEmail: organization.senderEmail,
        notifyEmail: organization.notifyEmail,
        phone: organization.phone,
        website: organization.website,
        brandColor: organization.brandColor,
        brandInk: organization.mainInkColor,
        language: organization.language,
        currency: organization.currency,
        timezone: availabilityRule.timezone,
      })
      .from(organization)
      .leftJoin(
        availabilityRule,
        and(
          eq(availabilityRule.organizationId, organization.id),
          isNull(availabilityRule.resourceId)
        )
      )
      .where(eq(organization.id, organizationId))
      .limit(1),
    db
      .select({ email: user.email })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(and(eq(member.organizationId, organizationId), eq(member.role, "owner")))
      .orderBy(asc(member.createdAt))
      .limit(1),
  ]);
  if (!row) return null;
  return { ...row, ownerEmail: owner?.email ?? null };
}
