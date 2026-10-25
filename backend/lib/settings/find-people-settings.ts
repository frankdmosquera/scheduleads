// Backend: what the owner's People page shows: every person and place of the business, on or off,
// the business's time zone for the bookings a turned-off one still holds, and the domain a work
// email must be at, each person's worker texts (feature 12g), and what each person can do and is on
// for, with the services to tick from (feature 12k).

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

import { db } from "../../database.js";
import { emailDomainOf } from "./email-domain-of.js";
import type { WorkerTextSettingsRowType } from "../text/find-worker-text-settings.js";
import { findWorkerTexts } from "./find-worker-texts.js";
import {
  resourceSettingsColumns,
  resourceSettingsOf,
  type ResourceSettingsType,
} from "./resource-settings-of.js";

export async function findPeopleSettings(organizationId: string): Promise<{
  people: ResourceSettingsType[];
  timezone: string | null; // null until the business's hours are first saved
  senderDomain: string | null; // null until the business has a sending address
  workerTexts: (WorkerTextSettingsRowType & { personId: string })[]; // a person not listed gets none
  textsSetUp: boolean; // false until the agency gives the business a texting number: none can go
  services: { id: string; name: string; active: boolean }[]; // every service, to tick on a card
  skills: { personId: string; serviceIds: string[]; onFor: string[] }[]; // one per person
}> {
  const [rows, [hours], [business], workerTexts, [texts], services, skillRows, onRows] =
    await Promise.all([
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
    ]);
  const idsOf = (pairs: { personId: string; serviceId: string }[], personId: string) =>
    pairs.filter((pair) => pair.personId === personId).map((pair) => pair.serviceId);
  return {
    people: rows.map(resourceSettingsOf),
    timezone: hours?.timezone ?? null,
    senderDomain: business?.senderEmail ? emailDomainOf(business.senderEmail) : null,
    workerTexts,
    textsSetUp: texts !== undefined,
    services,
    skills: rows
      .filter((row) => row.kind === "person")
      .map((row) => ({
        personId: row.id,
        serviceIds: idsOf(skillRows, row.id),
        onFor: idsOf(onRows, row.id),
      })),
  };
}
