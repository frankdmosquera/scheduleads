// Backend: what one person can do and is on for (feature 12k), read for their card and after a save.

import { and, asc, eq } from "drizzle-orm";

import { bookingLinkResource, personSkill } from "@scheduleads-app/shared/db";

import type { DatabaseExecutorType } from "../../database-executor-type.js";

export type PersonSkillsType = {
  serviceIds: string[]; // what they can do
  onFor: string[]; // the services they are on for now
};

export async function findPersonSkills(
  executor: DatabaseExecutorType,
  organizationId: string,
  personId: string
): Promise<PersonSkillsType> {
  const [skills, on] = await Promise.all([
    executor
      .select({ id: personSkill.bookingLinkId })
      .from(personSkill)
      .where(
        and(eq(personSkill.organizationId, organizationId), eq(personSkill.resourceId, personId))
      )
      .orderBy(asc(personSkill.bookingLinkId)),
    executor
      .select({ id: bookingLinkResource.bookingLinkId })
      .from(bookingLinkResource)
      .where(
        and(
          eq(bookingLinkResource.organizationId, organizationId),
          eq(bookingLinkResource.resourceId, personId)
        )
      )
      .orderBy(asc(bookingLinkResource.bookingLinkId)),
  ]);
  return { serviceIds: skills.map((row) => row.id), onFor: on.map((row) => row.id) };
}
