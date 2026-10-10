CREATE TABLE "booking_question" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"required" boolean NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_question_organization_id_unique" UNIQUE("organizationId","id"),
	CONSTRAINT "booking_question_label_check" CHECK (char_length("booking_question"."label") between 1 and 200 and "booking_question"."label" = btrim("booking_question"."label"))
);
--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "answers" jsonb;--> statement-breakpoint
ALTER TABLE "booking_question" ADD CONSTRAINT "booking_question_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_question_order_index" ON "booking_question" USING btree ("organizationId","position");