CREATE TABLE "pipeline_stage" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pipeline_stage_organization_id_unique" UNIQUE("organizationId","id")
);
--> statement-breakpoint
ALTER TABLE "pipeline_stage" ADD CONSTRAINT "pipeline_stage_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pipeline_stage_organization_name_unique" ON "pipeline_stage" USING btree ("organizationId",lower("name"));--> statement-breakpoint
-- Added by hand: every business that already exists gets the four default stages (packages/shared/crm/default-pipeline-stages.ts). New businesses get them from the afterCreateOrganization hook in backend/lib/auth/auth-server.ts, the dev businesses from the seed.
INSERT INTO "pipeline_stage" ("id", "organizationId", "name", "position")
SELECT gen_random_uuid()::text, "organization"."id", "stage"."name", "stage"."position"
FROM "organization"
CROSS JOIN (VALUES ('New', 1), ('Contacted', 2), ('Booked', 3), ('Done', 4)) AS "stage" ("name", "position");
