// Shared: the contact table. The people a business deals with, one timeline each. The same
// email in the same business is the same contact; no email is always new.

import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";

import { organization } from "../auth-tables/organization-table.js";

export const contact = pgTable(
  "contact",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"), // lowercase, trimmed; optional, a phone booking may have none
    phone: text("phone"), // as typed, trimmed; never used to match
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Exists so activity (and feature 5's lead) can point at (business, contact) together.
    unique("contact_organization_id_unique").on(table.organizationId, table.id),
    // What makes "same email, same contact" hold even for two bookings at the same instant.
    uniqueIndex("contact_organization_email_unique")
      .on(table.organizationId, table.email)
      .where(sql`${table.email} is not null`),
    // Stored the one way it is matched, so "Maria@X" and "maria@x" are never two contacts.
    check("contact_email_normalized_check", sql`${table.email} = lower(btrim(${table.email}))`),
  ]
);
