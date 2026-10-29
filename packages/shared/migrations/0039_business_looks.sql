ALTER TABLE "organization" ADD COLUMN "looks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "mainInkColor" text;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_main_ink_color_check" CHECK ("organization"."mainInkColor" ~ '^#[0-9a-f]{6}$');