CREATE TABLE "worker_text_settings" (
	"personId" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"phone" text NOT NULL,
	"addedOn" boolean NOT NULL,
	"movedOn" boolean NOT NULL,
	"removedOn" boolean NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "worker_text_settings_phone_check" CHECK ("worker_text_settings"."phone" ~ '^[+]1[2-9][0-9]{2}[2-9][0-9]{6}$')
);
--> statement-breakpoint
ALTER TABLE "worker_text_settings" ADD CONSTRAINT "worker_text_settings_person_fk" FOREIGN KEY ("organizationId","personId") REFERENCES "public"."resource"("organizationId","id") ON DELETE cascade ON UPDATE no action;