// Shared: the activity table. A contact's timeline (what happened) and the next-step queue
// (what is still owed) in one table: a row is one or the other, never both.

import { sql } from "drizzle-orm";
import { check, foreignKey, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { ACTIVITY_TYPES } from "../../crm/activity-types.js";
import { organization } from "../auth-tables/organization-table.js";
import { user } from "../auth-tables/user-table.js";
import { contact } from "./contact-table.js";

export const activity = pgTable(
  "activity",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: text("contactId").notNull(),
    type: text("type").notNull(),
    // Its shape belongs to the feature that writes each type; shown as text, never HTML.
    payload: jsonb("payload").notNull().default({}),
    // The login that did it; null when a customer or the system did.
    actorUserId: text("actorUserId").references(() => user.id, { onDelete: "set null" }),
    occurredAt: timestamp("occurredAt", { withTimezone: true }), // set: it happened
    dueAt: timestamp("dueAt", { withTimezone: true }), // set instead: a next step
    doneAt: timestamp("doneAt", { withTimezone: true }), // a next step, once ticked off
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Only a contact of the same business; the contact's timeline goes with it.
    foreignKey({
      name: "activity_contact_fk",
      columns: [table.organizationId, table.contactId],
      foreignColumns: [contact.organizationId, contact.id],
    }).onDelete("cascade"),
    check(
      "activity_type_check",
      sql`${table.type} in (${sql.raw(ACTIVITY_TYPES.map((type) => `'${type}'`).join(", "))})`
    ),
    check(
      "activity_kind_check",
      sql`(${table.occurredAt} is not null) <> (${table.dueAt} is not null)`
    ),
    check(
      "activity_done_needs_due_check",
      sql`${table.doneAt} is null or ${table.dueAt} is not null`
    ),
    index("activity_timeline_index").on(table.organizationId, table.contactId, table.occurredAt),
    index("activity_next_steps_index")
      .on(table.organizationId, table.dueAt)
      .where(sql`${table.dueAt} is not null and ${table.doneAt} is null`),
  ]
);
