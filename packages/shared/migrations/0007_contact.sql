CREATE TABLE "contact" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_organization_id_unique" UNIQUE("organizationId","id"),
	CONSTRAINT "contact_email_normalized_check" CHECK ("contact"."email" = lower(btrim("contact"."email")))
);
--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contact_organization_email_unique" ON "contact" USING btree ("organizationId","email") WHERE "contact"."email" is not null;