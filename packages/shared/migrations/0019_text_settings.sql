CREATE TABLE "text_settings" (
	"organizationId" text PRIMARY KEY NOT NULL,
	"fromNumber" text NOT NULL,
	"confirmationOn" boolean NOT NULL,
	"reminderMinutesBefore" integer[] NOT NULL,
	"replyPhone" text,
	"replyEmail" text,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "text_settings_fromNumber_unique" UNIQUE("fromNumber"),
	CONSTRAINT "text_settings_from_number_check" CHECK ("text_settings"."fromNumber" ~ '^[+]1[2-9][0-9]{2}[2-9][0-9]{6}$'),
	CONSTRAINT "text_settings_reply_phone_check" CHECK ("text_settings"."replyPhone" ~ '^[+]1[2-9][0-9]{2}[2-9][0-9]{6}$' and "text_settings"."replyPhone" <> "text_settings"."fromNumber"),
	CONSTRAINT "text_settings_reply_destination_check" CHECK ("text_settings"."replyPhone" is not null or "text_settings"."replyEmail" is not null),
	CONSTRAINT "text_settings_reminder_minutes_check" CHECK (0 < all("text_settings"."reminderMinutesBefore") and array_position("text_settings"."reminderMinutesBefore", null) is null)
);
--> statement-breakpoint
ALTER TABLE "text_settings" ADD CONSTRAINT "text_settings_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;