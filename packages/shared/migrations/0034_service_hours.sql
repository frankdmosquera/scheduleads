CREATE TABLE "service_hours" (
	"bookingLinkId" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"weeklyHours" jsonb,
	"dateHours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_hours" ADD CONSTRAINT "service_hours_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_hours" ADD CONSTRAINT "service_hours_booking_link_fk" FOREIGN KEY ("organizationId","bookingLinkId") REFERENCES "public"."booking_link"("organizationId","id") ON DELETE cascade ON UPDATE no action;