ALTER TABLE "activity" DROP CONSTRAINT "activity_type_check";--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "requestKey" text;--> statement-breakpoint
CREATE UNIQUE INDEX "lead_organization_request_key_unique" ON "lead" USING btree ("organizationId","requestKey") WHERE "lead"."requestKey" is not null;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_type_check" CHECK ("activity"."type" in ('booking_created', 'booking_cancelled', 'booking_moved', 'later_texts_yes', 'lead_added', 'stage_changed', 'email_sent', 'email_received', 'note', 'sms_sent', 'call', 'task'));