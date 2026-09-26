CREATE TABLE "availability_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"resourceId" text,
	"weeklyHours" jsonb,
	"dateHours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timezone" text,
	"minimumNoticeMinutes" integer,
	"horizonDays" integer,
	"closedDates" jsonb,
	"holidayCountry" text,
	"holidayRegion" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_rule_row_kind_check" CHECK ((
        "availability_rule"."resourceId" is null
        and "availability_rule"."weeklyHours" is not null
        and "availability_rule"."timezone" is not null
        and "availability_rule"."minimumNoticeMinutes" is not null
        and "availability_rule"."horizonDays" is not null
        and "availability_rule"."closedDates" is not null
      ) or (
        "availability_rule"."resourceId" is not null
        and "availability_rule"."timezone" is null
        and "availability_rule"."minimumNoticeMinutes" is null
        and "availability_rule"."horizonDays" is null
        and "availability_rule"."closedDates" is null
        and "availability_rule"."holidayCountry" is null
        and "availability_rule"."holidayRegion" is null
      )),
	CONSTRAINT "availability_rule_notice_check" CHECK ("availability_rule"."minimumNoticeMinutes" >= 0),
	CONSTRAINT "availability_rule_horizon_check" CHECK ("availability_rule"."horizonDays" > 0),
	CONSTRAINT "availability_rule_region_needs_country_check" CHECK ("availability_rule"."holidayRegion" is null or "availability_rule"."holidayCountry" is not null)
);
--> statement-breakpoint
CREATE TABLE "booking_link" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"durationMinutes" integer NOT NULL,
	"bufferBeforeMinutes" integer DEFAULT 0 NOT NULL,
	"bufferAfterMinutes" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_link_duration_check" CHECK ("booking_link"."durationMinutes" > 0),
	CONSTRAINT "booking_link_buffers_check" CHECK ("booking_link"."bufferBeforeMinutes" >= 0 and "booking_link"."bufferAfterMinutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "resource" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'person' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_organization_id_unique" UNIQUE("organizationId","id"),
	CONSTRAINT "resource_kind_check" CHECK ("resource"."kind" in ('person', 'place'))
);
--> statement-breakpoint
ALTER TABLE "availability_rule" ADD CONSTRAINT "availability_rule_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rule" ADD CONSTRAINT "availability_rule_resource_fk" FOREIGN KEY ("organizationId","resourceId") REFERENCES "public"."resource"("organizationId","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_link" ADD CONSTRAINT "booking_link_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "availability_rule_business_unique" ON "availability_rule" USING btree ("organizationId") WHERE "availability_rule"."resourceId" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "availability_rule_resource_unique" ON "availability_rule" USING btree ("organizationId","resourceId");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_link_organization_slug_unique" ON "booking_link" USING btree ("organizationId","slug");--> statement-breakpoint
-- Added by hand: every business that already exists gets its first person, named after the business. New businesses get theirs from the afterCreateOrganization hook in backend/src/lib/auth-server.ts.
INSERT INTO "resource" ("id", "organizationId", "name", "kind")
SELECT gen_random_uuid()::text, "organization"."id", "organization"."name", 'person'
FROM "organization"
WHERE NOT EXISTS (SELECT 1 FROM "resource" WHERE "resource"."organizationId" = "organization"."id");
