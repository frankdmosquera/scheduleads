// Shared: the contact table. The people a business deals with, one timeline each. The same
// email in the same business is the same contact; no email is always new.

import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";

import { organization } from "../auth-tables/organization-table.js";
import { STORED_TEXTABLE_PHONE_PATTERN } from "../text-tables/stored-textable-phone-pattern.js";

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
    // Her latest yes to later texts (feature 9, decision 13) and the number it was given for, as
    // Twilio texts it: a yes belongs to that number, never to whatever phone the contact has later.
    laterTextsYesAt: timestamp("laterTextsYesAt", { withTimezone: true }),
    laterTextsYesPhone: text("laterTextsYesPhone"),
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
    // A yes always has its number, and a number only comes with a yes.
    check(
      "contact_later_texts_yes_check",
      sql`(${table.laterTextsYesAt} is null) = (${table.laterTextsYesPhone} is null)`
    ),
    check(
      "contact_later_texts_yes_phone_check",
      sql`${table.laterTextsYesPhone} ~ ${sql.raw(`'${STORED_TEXTABLE_PHONE_PATTERN}'`)}`
    ),
  ]
);
