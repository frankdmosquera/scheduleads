ALTER TABLE "organization" ADD COLUMN "detailsLabel" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "detailsRequired" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_details_label_check" CHECK (char_length("organization"."detailsLabel") between 1 and 80);