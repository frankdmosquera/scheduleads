CREATE TABLE "text_reply" (
	"messageSid" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"textTriedAt" timestamp with time zone,
	"textSentAt" timestamp with time zone,
	"emailSentAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "text_reply" ADD CONSTRAINT "text_reply_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;