// Shared: the resource table. One person or one place (a room, a chair), never a group: a
// crew is a saved list of people (feature 19). Every business has at least one, its first
// person, made by migration 0001 or the hook in auth-server.ts.

import { sql } from "drizzle-orm";
import { boolean, check, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

import { organization } from "../auth-tables/organization-table.js";

export const resource = pgTable(
  "resource",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // the first person starts with the business's name; the owner renames it (feature 12)
    kind: text("kind").notNull().default("person"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("resource_kind_check", sql`${table.kind} in ('person', 'place')`),
    // Exists only so availability_rule can point at (business, person) together.
    unique("resource_organization_id_unique").on(table.organizationId, table.id),
  ]
);
