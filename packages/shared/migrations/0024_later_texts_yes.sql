CREATE TABLE "later_texts_yes" (
	"organizationId" text NOT NULL,
	"contactId" text NOT NULL,
	"phone" text NOT NULL,
	"yesAt" timestamp with time zone NOT NULL,
	CONSTRAINT "later_texts_yes_organizationId_contactId_phone_pk" PRIMARY KEY("organizationId","contactId","phone"),
	CONSTRAINT "later_texts_yes_phone_check" CHECK ("later_texts_yes"."phone" ~ '^[+]1[2-9][0-9]{2}[2-9][0-9]{6}$')
);
--> statement-breakpoint
ALTER TABLE "activity" DROP CONSTRAINT "activity_type_check";--> statement-breakpoint
ALTER TABLE "text_settings" ADD COLUMN "askLaterTextsYes" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "later_texts_yes" ADD CONSTRAINT "later_texts_yes_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "later_texts_yes" ADD CONSTRAINT "later_texts_yes_contact_fk" FOREIGN KEY ("organizationId","contactId") REFERENCES "public"."contact"("organizationId","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_type_check" CHECK ("activity"."type" in ('booking_created', 'booking_cancelled', 'booking_moved', 'later_texts_yes', 'stage_changed', 'email_sent', 'email_received', 'note', 'sms_sent', 'call', 'task'));