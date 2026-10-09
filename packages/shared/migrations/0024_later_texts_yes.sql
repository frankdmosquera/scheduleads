ALTER TABLE "activity" DROP CONSTRAINT "activity_type_check";--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "laterTextsYesAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "laterTextsYesPhone" text;--> statement-breakpoint
ALTER TABLE "text_settings" ADD COLUMN "askLaterTextsYes" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_type_check" CHECK ("activity"."type" in ('booking_created', 'booking_cancelled', 'booking_moved', 'later_texts_yes', 'stage_changed', 'email_sent', 'email_received', 'note', 'sms_sent', 'call', 'task'));--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_later_texts_yes_check" CHECK (("contact"."laterTextsYesAt" is null) = ("contact"."laterTextsYesPhone" is null));--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_later_texts_yes_phone_check" CHECK ("contact"."laterTextsYesPhone" ~ '^[+]1[2-9][0-9]{2}[2-9][0-9]{6}$');