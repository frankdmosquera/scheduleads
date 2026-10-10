// Shared: the booking_question table. A business's own questions on its booking form, asked after
// the standard ones, in order (feature 9, decision 5). Every answer is text for now; the owner edits
// them in feature 12, so until then they are set at the business's setup.

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { organization } from "../auth-tables/organization-table.js";

export const bookingQuestion = pgTable(
  "booking_question",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Lowest first. Not unique, so a later reorder needs no shuffling; ties go by id.
    position: integer("position").notNull(),
    label: text("label").notNull(), // the question as the customer reads it; shown as text, never HTML
    required: boolean("required").notNull(), // the business's choice, so no default (decision 30)
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("booking_question_organization_id_unique").on(table.organizationId, table.id),
    check(
      "booking_question_label_check",
      sql`char_length(${table.label}) between 1 and 200 and ${table.label} = btrim(${table.label})`
    ),
    index("booking_question_order_index").on(table.organizationId, table.position),
  ]
);
