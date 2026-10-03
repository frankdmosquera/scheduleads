CREATE TABLE "email_sending_key" (
	"organizationId" text PRIMARY KEY NOT NULL,
	"credentials" text NOT NULL,
	"savedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "senderEmail" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "notifyEmail" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "brandColor" text;--> statement-breakpoint
ALTER TABLE "email_sending_key" ADD CONSTRAINT "email_sending_key_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_brand_color_check" CHECK ("organization"."brandColor" ~ '^#[0-9a-f]{6}$');