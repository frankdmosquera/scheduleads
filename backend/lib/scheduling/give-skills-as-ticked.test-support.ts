// Test support: the carry-over of migration 0033 for one test business (feature 12k), so a fixture
// written as "ticked people, or anyone when nobody is ticked" keeps meaning what it says. Ticked
// people get the skill; a service with no person ticked gives every active person the skill and
// switches them on. Never shipped: tsconfig leaves *.test-support.ts out of dist/.

import { sql } from "drizzle-orm";

import { db } from "../../database.js";

export async function giveSkillsAsTicked(organizationId: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO "person_skill" ("organizationId", "resourceId", "bookingLinkId")
    SELECT "booking_link_resource"."organizationId", "booking_link_resource"."resourceId", "booking_link_resource"."bookingLinkId"
    FROM "booking_link_resource"
    JOIN "resource" ON "resource"."organizationId" = "booking_link_resource"."organizationId" AND "resource"."id" = "booking_link_resource"."resourceId"
    WHERE "resource"."kind" = 'person' AND "booking_link_resource"."organizationId" = ${organizationId}
    ON CONFLICT DO NOTHING`);
  await db.execute(sql`
    INSERT INTO "person_skill" ("organizationId", "resourceId", "bookingLinkId")
    SELECT "booking_link"."organizationId", "resource"."id", "booking_link"."id"
    FROM "booking_link"
    JOIN "resource" ON "resource"."organizationId" = "booking_link"."organizationId" AND "resource"."kind" = 'person' AND "resource"."active"
    WHERE "booking_link"."organizationId" = ${organizationId} AND NOT EXISTS (
      SELECT 1 FROM "booking_link_resource"
      JOIN "resource" AS "ticked" ON "ticked"."organizationId" = "booking_link_resource"."organizationId" AND "ticked"."id" = "booking_link_resource"."resourceId"
      WHERE "booking_link_resource"."bookingLinkId" = "booking_link"."id" AND "ticked"."kind" = 'person'
    )
    ON CONFLICT DO NOTHING`);
  await db.execute(sql`
    INSERT INTO "booking_link_resource" ("organizationId", "bookingLinkId", "resourceId")
    SELECT "person_skill"."organizationId", "person_skill"."bookingLinkId", "person_skill"."resourceId"
    FROM "person_skill"
    WHERE "person_skill"."organizationId" = ${organizationId} AND NOT EXISTS (
      SELECT 1 FROM "booking_link_resource"
      JOIN "resource" AS "ticked" ON "ticked"."organizationId" = "booking_link_resource"."organizationId" AND "ticked"."id" = "booking_link_resource"."resourceId"
      WHERE "booking_link_resource"."bookingLinkId" = "person_skill"."bookingLinkId" AND "ticked"."kind" = 'person'
    )
    ON CONFLICT DO NOTHING`);
}
