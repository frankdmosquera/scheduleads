ALTER TABLE "organization" ADD COLUMN "backgroundColor" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "textColor" text;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_background_color_check" CHECK ("organization"."backgroundColor" ~ '^#[0-9a-f]{6}$');--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_text_color_check" CHECK ("organization"."textColor" ~ '^#[0-9a-f]{6}$');