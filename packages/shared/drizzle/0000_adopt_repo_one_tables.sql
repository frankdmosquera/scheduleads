-- Adopt the tables the first repo left behind, rather than recreating them.
--
-- The database already holds all seven Better Auth tables plus booking_link,
-- availability_rule and calendar_connection, with one real tenant in them.
-- Against that database nothing here drops or recreates anything: this only
-- adds what this repo's schema has and the first repo's did not, and widens
-- the timestamps.
--
-- The timestamp conversions are lossless. The server runs Etc/UTC and Better
-- Auth writes UTC, so reading a naked timestamp as UTC is what it already
-- meant. Checked before writing this, not assumed.
--
-- It also has to build the schema from nothing, and until 2026-09-23 it
-- could not (F-06). Against an empty database the first ALTER TABLE failed
-- with relation "user" does not exist, so db:migrate could stand up no
-- staging, CI or replacement database. The CREATE TABLE IF NOT EXISTS block
-- below fixes that, and it sits in this file rather than a later one on
-- purpose: drizzle applies pending migrations in journal order inside one
-- transaction (drizzle-orm pg-core dialect.js, migrate()), so a bootstrap
-- numbered after this file would never be reached.
--
-- Editing an applied migration is normally wrong. It is safe here, and each
-- reason was read off the installed drizzle-orm rather than assumed. The
-- migrator skips any migration whose journal "when" is not later than the
-- newest one recorded in the ledger, so the live database never runs this
-- file again. It stores each file's hash but never compares it afterwards.
-- And every added statement is IF NOT EXISTS, so even a re-run against the
-- live database would change nothing.
--
-- On an empty database the block creates all seven tables in their final
-- shape, generated from schema.ts rather than typed by hand, with drizzle's
-- own constraint names so later generated migrations can refer to them. The
-- column ALTERs after it then change nothing, and the unique index at the
-- end is still created by its own statement. Foreign keys are inline rather
-- than drizzle's separate ADD CONSTRAINT, because an inline constraint is
-- skipped along with its CREATE when the table already exists, while ADD
-- CONSTRAINT has no IF NOT EXISTS form. Tables are created in dependency
-- order for the same reason.

--> statement-breakpoint
-- Create what an empty database lacks. A no-op wherever the table exists.
CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"banReason" text,
	"banExpires" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" text,
	"plan" text DEFAULT 'agency' NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	"activeOrganizationId" text,
	"impersonatedBy" text,
	CONSTRAINT "session_token_unique" UNIQUE("token"),
	CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"userId" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "member_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"inviterId" text NOT NULL,
	CONSTRAINT "invitation_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "invitation_inviterId_user_id_fk" FOREIGN KEY ("inviterId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint

-- The admin plugin's platform-role columns. Server-set only; Better Auth
-- declares them input:false, so no request body can write them.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banned" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banReason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banExpires" timestamp with time zone;--> statement-breakpoint

ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "impersonatedBy" text;--> statement-breakpoint

-- The package rung. Existing rows get 'agency', which is correct: the only
-- organization in here is the agency's own.
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "plan" text DEFAULT 'agency' NOT NULL;--> statement-breakpoint

-- Timestamps to timestamptz. A booking product that stores an instant
-- without its zone double-books.
ALTER TABLE "user" ALTER COLUMN "createdAt" TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "updatedAt" TYPE timestamp with time zone;--> statement-breakpoint

ALTER TABLE "session" ALTER COLUMN "expiresAt" TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "createdAt" TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "updatedAt" TYPE timestamp with time zone;--> statement-breakpoint

ALTER TABLE "account" ALTER COLUMN "accessTokenExpiresAt" TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "refreshTokenExpiresAt" TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "createdAt" TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "updatedAt" TYPE timestamp with time zone;--> statement-breakpoint

ALTER TABLE "verification" ALTER COLUMN "expiresAt" TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "createdAt" TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "updatedAt" TYPE timestamp with time zone;--> statement-breakpoint

ALTER TABLE "organization" ALTER COLUMN "createdAt" TYPE timestamp with time zone;--> statement-breakpoint

ALTER TABLE "member" ALTER COLUMN "createdAt" TYPE timestamp with time zone;--> statement-breakpoint

ALTER TABLE "invitation" ALTER COLUMN "expiresAt" TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invitation" ALTER COLUMN "createdAt" TYPE timestamp with time zone;--> statement-breakpoint

-- One membership row per user per organization. Step 1.3 refuses to act when
-- someone belongs to two businesses; that is only sound if a duplicate row
-- cannot exist, so the database enforces it rather than the code hoping.
CREATE UNIQUE INDEX IF NOT EXISTS "member_organization_user_unique"
  ON "member" ("organizationId", "userId");
