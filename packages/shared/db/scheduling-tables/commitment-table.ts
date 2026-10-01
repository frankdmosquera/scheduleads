// Shared: the commitment table. One row says one person or place is taken from startsAt to
// endsAt, by a booking or by time off. The database refuses two active rows for the same one
// that overlap (commitment_no_overlap, added by hand in migration 0009: Drizzle cannot express
// an exclusion constraint), so no code path can double-book.

import { sql } from "drizzle-orm";
import { check, foreignKey, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "../auth-tables/organization-table.js";
import { resource } from "../booking-tables/resource-table.js";

export const commitment = pgTable(
  "commitment",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    resourceId: text("resourceId").notNull(),
    kind: text("kind").notNull(),
    bookingId: text("bookingId"), // its link to booking arrives with feature 5d
    // Half-open, [startsAt, endsAt): one ending at 3pm and the next starting at 3pm do not
    // overlap. A booking's buffers are already inside this range.
    startsAt: timestamp("startsAt", { withTimezone: true }).notNull(),
    endsAt: timestamp("endsAt", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("active"), // cancelled stops blocking
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Only a person or place of the same business. No action on delete: one that still holds
    // time cannot be deleted, while deleting the whole business takes these rows.
    foreignKey({
      name: "commitment_resource_fk",
      columns: [table.organizationId, table.resourceId],
      foreignColumns: [resource.organizationId, resource.id],
    }).onDelete("no action"),
    check("commitment_kind_check", sql`${table.kind} in ('booking', 'time_off')`),
    check("commitment_status_check", sql`${table.status} in ('active', 'cancelled')`),
    check("commitment_time_order_check", sql`${table.endsAt} > ${table.startsAt}`),
  ]
);
