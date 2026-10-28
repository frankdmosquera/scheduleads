ALTER TABLE "organization" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "booking_link" ADD COLUMN "priceCents" integer;--> statement-breakpoint
ALTER TABLE "booking_link" ADD COLUMN "priceFrom" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_currency_check" CHECK ("organization"."currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "booking_link" ADD CONSTRAINT "booking_link_price_check" CHECK ("booking_link"."priceCents" is null or "booking_link"."priceCents" >= 0);--> statement-breakpoint
ALTER TABLE "booking_link" ADD CONSTRAINT "booking_link_price_from_check" CHECK ("booking_link"."priceFrom" = false or "booking_link"."priceCents" is not null);