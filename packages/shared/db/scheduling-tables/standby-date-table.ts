// Shared: the standby_date table. One row per person per date they are on standby: at work,
// hidden from customers that day, still placeable by the owner. Off is time off, a commitment.
// The date is the business's own calendar date, kept as YYYY-MM-DD text, never shifted by a zone.

import { date, foreignKey, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "../auth-tables/organization-table.js";
import { resource } from "../booking-tables/resource-table.js";

export const standbyDate = pgTable(
  "standby_date",
  {
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    resourceId: text("resourceId").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "standby_date_pkey", columns: [table.resourceId, table.date] }),
    // Only a person of the same business; their standby dates go with them.
    foreignKey({
      name: "standby_date_resource_fk",
      columns: [table.organizationId, table.resourceId],
      foreignColumns: [resource.organizationId, resource.id],
    }).onDelete("cascade"),
  ]
);
