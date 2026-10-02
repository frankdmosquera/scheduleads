-- Moved by hand to the top: the foreign key to booking_link(organizationId, id) below needs this unique first; drizzle-kit writes it last.
ALTER TABLE "booking_link" ADD CONSTRAINT "booking_link_organization_id_unique" UNIQUE("organizationId","id");--> statement-breakpoint
CREATE TABLE "booking_link_resource" (
	"organizationId" text NOT NULL,
	"bookingLinkId" text NOT NULL,
	"resourceId" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_link_resource_bookingLinkId_resourceId_pk" PRIMARY KEY("bookingLinkId","resourceId")
);--> statement-breakpoint
ALTER TABLE "booking_link_resource" ADD CONSTRAINT "booking_link_resource_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_link_resource" ADD CONSTRAINT "booking_link_resource_booking_link_fk" FOREIGN KEY ("organizationId","bookingLinkId") REFERENCES "public"."booking_link"("organizationId","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_link_resource" ADD CONSTRAINT "booking_link_resource_resource_fk" FOREIGN KEY ("organizationId","resourceId") REFERENCES "public"."resource"("organizationId","id") ON DELETE no action ON UPDATE no action;
