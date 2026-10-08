// Shared: the lead table. One request for work from a contact: which stage of the pipeline it is
// in, where it came from and what the customer wrote. A contact who comes back is a new lead.

import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { organization } from "../auth-tables/organization-table.js";
import { contact } from "./contact-table.js";
import { pipelineStage } from "./pipeline-stage-table.js";

// One answer to the business's own question, with the question's words as they were asked, so
// rewording a question later never changes what a customer was asked (feature 9, decision 5).
export type LeadAnswerType = { questionId: string; question: string; answer: string };

export const lead = pgTable(
  "lead",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: text("contactId").notNull(),
    stageId: text("stageId").notNull(),
    source: text("source").notNull(),
    details: text("details"), // the customer's own words; shown as text, never HTML
    phone: text("phone"), // the phone given with this request; the contact keeps the first one given
    // The answers to the business's own questions, in its order; a blank optional one is left
    // out. Null when the business asked nothing. Shown as text, never HTML.
    answers: jsonb("answers").$type<LeadAnswerType[]>(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Exists so booking can point at (business, lead) together.
    unique("lead_organization_id_unique").on(table.organizationId, table.id),
    // Only a contact of the same business; its leads go with it, unless one has a booking.
    foreignKey({
      name: "lead_contact_fk",
      columns: [table.organizationId, table.contactId],
      foreignColumns: [contact.organizationId, contact.id],
    }).onDelete("cascade"),
    // Only a stage of the same business. No action: a stage still holding leads cannot be deleted.
    foreignKey({
      name: "lead_stage_fk",
      columns: [table.organizationId, table.stageId],
      foreignColumns: [pipelineStage.organizationId, pipelineStage.id],
    }).onDelete("no action"),
    // The business's own site, the hosted page (/book/<slug>), or the owner.
    check("lead_source_check", sql`${table.source} in ('widget', 'hosted', 'manual')`),
    index("lead_stage_index").on(table.organizationId, table.stageId),
    index("lead_contact_index").on(table.organizationId, table.contactId),
  ]
);
