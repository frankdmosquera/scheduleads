CREATE TABLE "booking" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"leadId" text NOT NULL,
	"bookingLinkId" text NOT NULL,
	"personId" text NOT NULL,
	"placeId" text,
	"startsAt" timestamp with time zone NOT NULL,
	"endsAt" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"location" text NOT NULL,
	"calendarEventId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_organization_id_unique" UNIQUE("organizationId","id"),
	CONSTRAINT "booking_status_check" CHECK ("booking"."status" in ('confirmed', 'cancelled')),
	CONSTRAINT "booking_time_order_check" CHECK ("booking"."endsAt" > "booking"."startsAt"),
	CONSTRAINT "booking_location_check" CHECK (length(btrim("booking"."location")) > 0)
);
--> statement-breakpoint
CREATE TABLE "lead" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"contactId" text NOT NULL,
	"stageId" text NOT NULL,
	"source" text NOT NULL,
	"details" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_organization_id_unique" UNIQUE("organizationId","id"),
	CONSTRAINT "lead_source_check" CHECK ("lead"."source" in ('widget', 'hosted', 'manual'))
);
--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_lead_fk" FOREIGN KEY ("organizationId","leadId") REFERENCES "public"."lead"("organizationId","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_booking_link_fk" FOREIGN KEY ("organizationId","bookingLinkId") REFERENCES "public"."booking_link"("organizationId","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_person_fk" FOREIGN KEY ("organizationId","personId") REFERENCES "public"."resource"("organizationId","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_place_fk" FOREIGN KEY ("organizationId","placeId") REFERENCES "public"."resource"("organizationId","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_contact_fk" FOREIGN KEY ("organizationId","contactId") REFERENCES "public"."contact"("organizationId","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_stage_fk" FOREIGN KEY ("organizationId","stageId") REFERENCES "public"."pipeline_stage"("organizationId","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_starts_at_index" ON "booking" USING btree ("organizationId","startsAt");--> statement-breakpoint
CREATE INDEX "booking_lead_index" ON "booking" USING btree ("organizationId","leadId");--> statement-breakpoint
CREATE INDEX "lead_stage_index" ON "lead" USING btree ("organizationId","stageId");--> statement-breakpoint
CREATE INDEX "lead_contact_index" ON "lead" USING btree ("organizationId","contactId");--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_booking_fk" FOREIGN KEY ("organizationId","bookingId") REFERENCES "public"."booking"("organizationId","id") ON DELETE no action ON UPDATE no action;