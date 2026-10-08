-- Existing services keep today's behaviour (the month modal, any available), then both become required with no default (feature 9, decisions 3 and 4).
ALTER TABLE "booking_link" ADD COLUMN "layout" text;--> statement-breakpoint
ALTER TABLE "booking_link" ADD COLUMN "personChoice" text;--> statement-breakpoint
UPDATE "booking_link" SET "layout" = 'month', "personChoice" = 'business_assigns';--> statement-breakpoint
ALTER TABLE "booking_link" ALTER COLUMN "layout" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_link" ALTER COLUMN "personChoice" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_link" ADD CONSTRAINT "booking_link_layout_check" CHECK ("booking_link"."layout" in ('month'));--> statement-breakpoint
ALTER TABLE "booking_link" ADD CONSTRAINT "booking_link_person_choice_check" CHECK ("booking_link"."personChoice" in ('customer_picks', 'business_assigns'));
