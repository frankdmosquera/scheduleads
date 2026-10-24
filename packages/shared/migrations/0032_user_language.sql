ALTER TABLE "user" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_language_check" CHECK ("user"."language" in ('en', 'es'));