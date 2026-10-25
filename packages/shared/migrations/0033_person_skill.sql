CREATE TABLE "person_skill" (
	"organizationId" text NOT NULL,
	"resourceId" text NOT NULL,
	"bookingLinkId" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_skill_resourceId_bookingLinkId_pk" PRIMARY KEY("resourceId","bookingLinkId")
);
--> statement-breakpoint
ALTER TABLE "person_skill" ADD CONSTRAINT "person_skill_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_skill" ADD CONSTRAINT "person_skill_resource_fk" FOREIGN KEY ("organizationId","resourceId") REFERENCES "public"."resource"("organizationId","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_skill" ADD CONSTRAINT "person_skill_booking_link_fk" FOREIGN KEY ("organizationId","bookingLinkId") REFERENCES "public"."booking_link"("organizationId","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- The carry-over (feature 12k): nothing bookable changes. Everyone ticked on a service can do it.
INSERT INTO "person_skill" ("organizationId", "resourceId", "bookingLinkId")
SELECT "booking_link_resource"."organizationId", "booking_link_resource"."resourceId", "booking_link_resource"."bookingLinkId"
FROM "booking_link_resource"
JOIN "resource" ON "resource"."organizationId" = "booking_link_resource"."organizationId" AND "resource"."id" = "booking_link_resource"."resourceId"
WHERE "resource"."kind" = 'person'
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- A service with nobody ticked meant anyone: every active person can do it, and is on for it.
INSERT INTO "person_skill" ("organizationId", "resourceId", "bookingLinkId")
SELECT "booking_link"."organizationId", "resource"."id", "booking_link"."id"
FROM "booking_link"
JOIN "resource" ON "resource"."organizationId" = "booking_link"."organizationId" AND "resource"."kind" = 'person' AND "resource"."active"
WHERE NOT EXISTS (
  SELECT 1 FROM "booking_link_resource"
  JOIN "resource" AS "ticked" ON "ticked"."organizationId" = "booking_link_resource"."organizationId" AND "ticked"."id" = "booking_link_resource"."resourceId"
  WHERE "booking_link_resource"."bookingLinkId" = "booking_link"."id" AND "ticked"."kind" = 'person'
)
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "booking_link_resource" ("organizationId", "bookingLinkId", "resourceId")
SELECT "person_skill"."organizationId", "person_skill"."bookingLinkId", "person_skill"."resourceId"
FROM "person_skill"
WHERE NOT EXISTS (
  SELECT 1 FROM "booking_link_resource"
  JOIN "resource" AS "ticked" ON "ticked"."organizationId" = "booking_link_resource"."organizationId" AND "ticked"."id" = "booking_link_resource"."resourceId"
  WHERE "booking_link_resource"."bookingLinkId" = "person_skill"."bookingLinkId" AND "ticked"."kind" = 'person'
)
ON CONFLICT DO NOTHING;
