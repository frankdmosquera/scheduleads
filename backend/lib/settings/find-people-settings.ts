// Backend: what the owner's People page shows: every person and place of the business, on or off,
// the business's time zone for the bookings a turned-off one still holds, and the domain a work
// email must be at.

import { and, asc, eq, isNull } from "drizzle-orm";

import { availabilityRule, organization, resource } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { emailDomainOf } from "./email-domain-of.js";
import {
  resourceSettingsColumns,
  resourceSettingsOf,
  type ResourceSettingsType,
} from "./resource-settings-of.js";

export async function findPeopleSettings(organizationId: string): Promise<{
  people: ResourceSettingsType[];
  timezone: string | null; // null until the business's hours are first saved
  senderDomain: string | null; // null until the business has a sending address
}> {
  const [rows, [hours], [business]] = await Promise.all([
    db
      .select(resourceSettingsColumns)
      .from(resource)
      .where(eq(resource.organizationId, organizationId))
      .orderBy(asc(resource.name), asc(resource.id)),
    db
      .select({ timezone: availabilityRule.timezone })
      .from(availabilityRule)
      .where(
        and(
          eq(availabilityRule.organizationId, organizationId),
          isNull(availabilityRule.resourceId)
        )
      )
      .limit(1),
    db
      .select({ senderEmail: organization.senderEmail })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1),
  ]);
  return {
    people: rows.map(resourceSettingsOf),
    timezone: hours?.timezone ?? null,
    senderDomain: business?.senderEmail ? emailDomainOf(business.senderEmail) : null,
  };
}
