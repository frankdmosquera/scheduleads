-- The booking form's rules (feature 12f). Each business says which way to reach the customer it
-- requires; every business so far took either one, so they keep it. Each service's yes or no to
-- the address becomes one of three: a yes is required, a no is not asked.
ALTER TABLE "organization" ADD COLUMN "contactRule" text DEFAULT 'either' NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_link" ADD COLUMN "addressMode" text;--> statement-breakpoint
UPDATE "booking_link" SET "addressMode" = CASE WHEN "asksAddress" THEN 'required' ELSE 'not_asked' END;--> statement-breakpoint
ALTER TABLE "booking_link" ALTER COLUMN "addressMode" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_contact_rule_check" CHECK ("organization"."contactRule" in ('email', 'phone', 'either'));--> statement-breakpoint
ALTER TABLE "booking_link" ADD CONSTRAINT "booking_link_address_mode_check" CHECK ("booking_link"."addressMode" in ('required', 'optional', 'not_asked'));
