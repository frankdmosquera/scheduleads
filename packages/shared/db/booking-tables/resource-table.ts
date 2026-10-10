// Shared: the resource table. One person or one place (a room, a chair), never a group: a
// crew is a saved list of people (feature 19). Every business has at least one, its first
// person, made by migration 0001 or the hook in auth-server.ts.

import { sql } from "drizzle-orm";
import { boolean, check, pgTable, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";

import { organization } from "../auth-tables/organization-table.js";
import { user } from "../auth-tables/user-table.js";

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
    // The login this person is, so the app knows whose calendar "you" connect. Set by
    // migration 0004, the create hook and the seed; never from a request.
    userId: text("userId").references(() => user.id, { onDelete: "set null" }),
    // A person's address at the business's sending domain, trimmed and lowercased (feature 12d):
    // the customer's replies go to it and it gets its own new-booking email. Null: none.
    workEmail: text("workEmail"),
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
    // One login is at most one person in a business.
    uniqueIndex("resource_organization_user_unique")
      .on(table.organizationId, table.userId)
      .where(sql`${table.userId} is not null`),
    // A place has no work email.
    check(
      "resource_work_email_is_person_check",
      sql`${table.workEmail} is null or ${table.kind} = 'person'`
    ),
    // A place never logs in.
    check(
      "resource_user_is_person_check",
      sql`${table.userId} is null or ${table.kind} = 'person'`
    ),
  ]
);
