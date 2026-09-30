// Backend script helper: whose calendar calendar:check reads. The login's person, their
// business and its time zone, or a plain refusal saying what is missing.

import { and, eq } from "drizzle-orm";

import { organization, resource, user } from "@scheduleads-app/shared/db";

import { db } from "../database.js";
import { resolveBookableHours } from "../lib/bookable-hours/resolve-bookable-hours.js";

export type CalendarCheckTargetType = {
  organizationId: string;
  businessName: string;
  resourceId: string;
  personName: string;
  timezone: string; // the business's own, from its hours
};

export async function findCalendarCheckTarget(email: string): Promise<CalendarCheckTargetType> {
  const [login] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email.trim().toLowerCase()))
    .limit(1);
  if (!login) throw new Error(`There is no login with the address ${email}.`);

  const people = await db
    .select({
      organizationId: organization.id,
      businessName: organization.name,
      slug: organization.slug,
      resourceId: resource.id,
      personName: resource.name,
    })
    .from(resource)
    .innerJoin(organization, eq(organization.id, resource.organizationId))
    .where(and(eq(resource.userId, login.id), eq(resource.kind, "person")));

  if (people.length === 0) {
    throw new Error(`${email} is not a person in any business, so it has no calendar to read.`);
  }
  if (people.length > 1) {
    const slugs = people.map((person) => person.slug).join(", ");
    throw new Error(
      `${email} is a person in more than one business (${slugs}); calendar:check reads one.`
    );
  }

  const [person] = people;
  // A guess would print every busy time at the wrong hour, so no hours means no check.
  const hours = await resolveBookableHours(person.organizationId, null, new Date());
  if (!hours) {
    throw new Error(
      `${person.businessName} has no hours set, so it has no time zone to print the times in.`
    );
  }

  return {
    organizationId: person.organizationId,
    businessName: person.businessName,
    resourceId: person.resourceId,
    personName: person.personName,
    timezone: hours.timezone,
  };
}
