ALTER TABLE "organization" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_language_check" CHECK ("organization"."language" in ('en', 'es'));--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_language_check" CHECK ("booking"."language" in ('en', 'es'));