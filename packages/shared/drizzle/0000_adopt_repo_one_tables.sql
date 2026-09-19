-- Adopt the tables the first repo left behind, rather than recreating them.
--
-- The database already holds all seven Better Auth tables plus booking_link,
-- availability_rule and calendar_connection, with one real tenant in them.
-- Nothing here drops or recreates anything: this only adds what this repo's
-- schema has and the first repo's did not, and widens the timestamps.
--
-- The timestamp conversions are lossless. The server runs Etc/UTC and Better
-- Auth writes UTC, so reading a naked timestamp as UTC is what it already
-- meant. Checked before writing this, not assumed.

--> statement-breakpoint
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
