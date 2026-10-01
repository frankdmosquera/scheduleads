CREATE TABLE "activity" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"contactId" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actorUserId" text,
	"occurredAt" timestamp with time zone,
	"dueAt" timestamp with time zone,
	"doneAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_type_check" CHECK ("activity"."type" in ('booking_created', 'stage_changed', 'email_sent', 'email_received', 'note', 'sms_sent', 'call', 'task')),
	CONSTRAINT "activity_kind_check" CHECK (("activity"."occurredAt" is not null) <> ("activity"."dueAt" is not null)),
	CONSTRAINT "activity_done_needs_due_check" CHECK ("activity"."doneAt" is null or "activity"."dueAt" is not null)
);
--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_actorUserId_user_id_fk" FOREIGN KEY ("actorUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_contact_fk" FOREIGN KEY ("organizationId","contactId") REFERENCES "public"."contact"("organizationId","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_timeline_index" ON "activity" USING btree ("organizationId","contactId","occurredAt");--> statement-breakpoint
CREATE INDEX "activity_next_steps_index" ON "activity" USING btree ("organizationId","dueAt") WHERE "activity"."dueAt" is not null and "activity"."doneAt" is null;