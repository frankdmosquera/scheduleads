CREATE TABLE "standby_date" (
	"organizationId" text NOT NULL,
	"resourceId" text NOT NULL,
	"date" date NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "standby_date_pkey" PRIMARY KEY("resourceId","date")
);
--> statement-breakpoint
ALTER TABLE "standby_date" ADD CONSTRAINT "standby_date_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standby_date" ADD CONSTRAINT "standby_date_resource_fk" FOREIGN KEY ("organizationId","resourceId") REFERENCES "public"."resource"("organizationId","id") ON DELETE cascade ON UPDATE no action;