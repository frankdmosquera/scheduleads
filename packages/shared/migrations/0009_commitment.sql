-- Added by hand: the standard add-on that lets one exclusion rule compare a text id (=) and a time range (&&) together. Shipped with Postgres; it still has to be switched on in each database.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE TABLE "commitment" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"resourceId" text NOT NULL,
	"kind" text NOT NULL,
	"bookingId" text,
	"startsAt" timestamp with time zone NOT NULL,
	"endsAt" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commitment_kind_check" CHECK ("commitment"."kind" in ('booking', 'time_off')),
	CONSTRAINT "commitment_status_check" CHECK ("commitment"."status" in ('active', 'cancelled')),
	CONSTRAINT "commitment_time_order_check" CHECK ("commitment"."endsAt" > "commitment"."startsAt")
);
--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_resource_fk" FOREIGN KEY ("organizationId","resourceId") REFERENCES "public"."resource"("organizationId","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commitment_resource_index" ON "commitment" USING btree ("organizationId","resourceId");
--> statement-breakpoint
-- Added by hand, as Drizzle cannot express it: no two active commitments for the same person or place may overlap. Half-open ranges, so back to back is allowed; a cancelled row stops blocking. The business is compared too, so a row naming another business's person never meets that person's time and is refused by commitment_resource_fk as not theirs, never as busy.
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_no_overlap" EXCLUDE USING gist ("organizationId" WITH =, "resourceId" WITH =, tstzrange("startsAt", "endsAt", '[)') WITH &&) WHERE ("status" = 'active');
