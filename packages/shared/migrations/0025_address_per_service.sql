-- Each service says whether it asks for the customer's address (the address fix). Every
-- existing service asked until now, so they start at true; no default is left (decision 30).
ALTER TABLE "booking" ALTER COLUMN "location" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_link" ADD COLUMN "asksAddress" boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE "booking_link" ALTER COLUMN "asksAddress" DROP DEFAULT;
