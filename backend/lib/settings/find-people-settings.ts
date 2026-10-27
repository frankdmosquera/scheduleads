// Backend: what the owner's People page shows: every person of the business, on or off, the
// business's time zone for the bookings a turned-off one still holds, and the domain a work email
// must be at, each person's worker texts (feature 12g), what each can do and is on for, with the
// services to tick from, and each one's bookable hours beside the business's week (feature 12k).
// Places have their own page.

import { and, asc, eq, isNull } from "drizzle-orm";

import {
  availabilityRule,
  bookingLink,
  bookingLinkResource,
  organization,
  personSkill,
  resource,
  textSettings,
} from "@scheduleads-app/shared/db";
import type { PersonHoursType, WeeklyHoursType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { resolveBusinessSender } from "../email/resolve-business-sender.js";
import type { WorkerTextSettingsRowType } from "../text/find-worker-text-settings.js";
import { findPeopleHours } from "./find-people-hours.js";
import { findWorkerTexts } from "./find-worker-texts.js";
import {
  resourceSettingsColumns,
  resourceSettingsOf,
  type ResourceSettingsType,
} from "./resource-settings-of.js";

export async function findPeopleSettings(organizationId: string): Promise<{
  people: ResourceSettingsType[];
  timezone: string | null; // null until the business's hours are first saved
  businessWeek: WeeklyHoursType | null; // copied into a person's own hours; null like timezone
  senderDomain: string | null; // null until the business has a sending address
  workerTexts: (WorkerTextSettingsRowType & { personId: string })[]; // a person not listed gets none
  textsSetUp: boolean; // false until the agency gives the business a texting number: none can go
  services: { id: string; name: string; active: boolean }[]; // every service, to tick on a card
  skills: { personId: string; serviceIds: string[]; onFor: string[] }[]; // one per person
  hours: ({ personId: string } & PersonHoursType)[]; // one per person; no own row: whenever open
}> {
  const [rows, [hours], [business], workerTexts, [texts], services, skillRows, onRows, own] =
    await Promise.all([
      db
        .select(resourceSettingsColumns)
        .from(resource)
        .where(and(eq(resource.organizationId, organizationId), eq(resource.kind, "person")))
        .orderBy(asc(resource.name), asc(resource.id)),
      db
        .select({ timezone: availabilityRule.timezone, weeklyHours: availabilityRule.weeklyHours })
        .from(availabilityRule)
        .where(
          and(
            eq(availabilityRule.organizationId, organizationId),
            isNull(availabilityRule.resourceId)
          )
        )
        .limit(1),
      db
        .select({
          name: organization.name,
          senderEmail: organization.senderEmail,
          website: organization.website,
        })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1),
      findWorkerTexts(db, organizationId),
      db
        .select({ id: textSettings.organizationId })
        .from(textSettings)
        .where(eq(textSettings.organizationId, organizationId))
        .limit(1),
      db
        .select({ id: bookingLink.id, name: bookingLink.name, active: bookingLink.active })
        .from(bookingLink)
        .where(eq(bookingLink.organizationId, organizationId))
        .orderBy(asc(bookingLink.name), asc(bookingLink.id)),
      db
        .select({ personId: personSkill.resourceId, serviceId: personSkill.bookingLinkId })
        .from(personSkill)
        .where(eq(personSkill.organizationId, organizationId)),
      db
        .select({
          personId: bookingLinkResource.resourceId,
          serviceId: bookingLinkResource.bookingLinkId,
        })
        .from(bookingLinkResource)
        .where(eq(bookingLinkResource.organizationId, organizationId)),
      findPeopleHours(db, organizationId),
    ]);
  const idsOf = (pairs: { personId: string; serviceId: string }[], personId: string) =>
    pairs.filter((pair) => pair.personId === personId).map((pair) => pair.serviceId);
  return {
    people: rows.map(resourceSettingsOf),
    timezone: hours?.timezone ?? null,
    businessWeek: hours?.weeklyHours ?? null,
    // Its own sending domain (25a): from its saved sender, else its website once set up.
    senderDomain: business
      ? (
          await resolveBusinessSender({
            name: business.name,
            savedSender: business.senderEmail,
            website: business.website,
          })
        ).ownDomain
      : null,
    workerTexts,
    textsSetUp: texts !== undefined,
    services,
    skills: rows.map((row) => ({
      personId: row.id,
      serviceIds: idsOf(skillRows, row.id),
      onFor: idsOf(onRows, row.id),
    })),
    hours: rows.map((row) => ({
      personId: row.id,
      weeklyHours: own.get(row.id)?.weeklyHours ?? null,
      dateHours: own.get(row.id)?.dateHours ?? [],
    })),
  };
}
