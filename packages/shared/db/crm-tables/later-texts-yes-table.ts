// Shared: the later_texts_yes table. A customer's yes to later texts (feature 9, decision 13), one row
// per number she said yes for, with the date of her latest yes for it. A yes belongs to a number,
// so a tick with another number adds a row and never moves one.

import { sql } from "drizzle-orm";
import { check, foreignKey, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "../auth-tables/organization-table.js";
import { STORED_TEXTABLE_PHONE_PATTERN } from "../text-tables/stored-textable-phone-pattern.js";
import { contact } from "./contact-table.js";

export const laterTextsYes = pgTable(
  "later_texts_yes",
  {
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: text("contactId").notNull(),
    phone: text("phone").notNull(), // as Twilio texts it, "+14035550148"
    yesAt: timestamp("yesAt", { withTimezone: true }).notNull(), // her latest yes for this number
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.contactId, table.phone] }),
    // Only a contact of the same business; her yeses go with her.
    foreignKey({
      name: "later_texts_yes_contact_fk",
      columns: [table.organizationId, table.contactId],
      foreignColumns: [contact.organizationId, contact.id],
    }).onDelete("cascade"),
    check(
      "later_texts_yes_phone_check",
      sql`${table.phone} ~ ${sql.raw(`'${STORED_TEXTABLE_PHONE_PATTERN}'`)}`
    ),
  ]
);
