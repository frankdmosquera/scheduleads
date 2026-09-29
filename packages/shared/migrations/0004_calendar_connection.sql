CREATE TABLE "calendar_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"resourceId" text NOT NULL,
	"provider" text NOT NULL,
	"accountEmail" text NOT NULL,
	"credentials" text NOT NULL,
	"grantedScopes" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"lastCheckedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_connection_resource_unique" UNIQUE("resourceId"),
	CONSTRAINT "calendar_connection_provider_check" CHECK ("calendar_connection"."provider" in ('google')),
	CONSTRAINT "calendar_connection_status_check" CHECK ("calendar_connection"."status" in ('connected', 'needs_reconnect'))
);
--> statement-breakpoint
CREATE TABLE "calendar_oauth_state" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"organizationId" text NOT NULL,
	"resourceId" text NOT NULL,
	"codeVerifier" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource" ADD COLUMN "userId" text;--> statement-breakpoint
ALTER TABLE "calendar_connection" ADD CONSTRAINT "calendar_connection_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_connection" ADD CONSTRAINT "calendar_connection_resource_fk" FOREIGN KEY ("organizationId","resourceId") REFERENCES "public"."resource"("organizationId","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_oauth_state" ADD CONSTRAINT "calendar_oauth_state_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_oauth_state" ADD CONSTRAINT "calendar_oauth_state_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_oauth_state" ADD CONSTRAINT "calendar_oauth_state_resource_fk" FOREIGN KEY ("organizationId","resourceId") REFERENCES "public"."resource"("organizationId","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "resource_organization_user_unique" ON "resource" USING btree ("organizationId","userId") WHERE "resource"."userId" is not null;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_user_is_person_check" CHECK ("resource"."userId" is null or "resource"."kind" = 'person');--> statement-breakpoint
-- Added by hand: in every business that already exists, the first person is linked to the owner, when there is exactly one; otherwise it stays unlinked rather than guess. The first person is the one migration 0001 or the create hook made, named after the business; oldest only breaks a tie, because the seed makes all its people in one transaction with the same createdAt. New businesses get the link from the afterCreateOrganization hook in backend/lib/auth/auth-server.ts.
UPDATE "resource" SET "userId" = "owner"."userId"
FROM (
	SELECT "organizationId", min("userId") AS "userId"
	FROM "member"
	WHERE "role" = 'owner'
	GROUP BY "organizationId"
	HAVING count(*) = 1
) AS "owner",
(
	SELECT DISTINCT ON ("resource"."organizationId") "resource"."id", "resource"."organizationId"
	FROM "resource"
	JOIN "organization" ON "organization"."id" = "resource"."organizationId"
	WHERE "resource"."kind" = 'person'
	ORDER BY "resource"."organizationId", ("resource"."name" = "organization"."name") DESC, "resource"."createdAt", "resource"."id"
) AS "first_person"
WHERE "resource"."id" = "first_person"."id"
	AND "first_person"."organizationId" = "owner"."organizationId";
