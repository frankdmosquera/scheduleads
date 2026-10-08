// Shared: the text_settings table. One business's own choices for its texts (feature 8b,
// decision 2): its number in the agency's Twilio account, whether the confirmation text goes,
// its reminders, and where a customer's reply is passed on to. Nothing has a default: a business
// with no row sends no texts. Set at client setup until Settings (feature 12).

import { sql } from "drizzle-orm";
import { boolean, check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "../auth-tables/organization-table.js";
import { NORTH_AMERICAN_NUMBER } from "./north-american-number.js";

export const textSettings = pgTable(
  "text_settings",
  {
    organizationId: text("organizationId")
      .primaryKey()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Unique: a reply is told apart by the number it was sent to.
    fromNumber: text("fromNumber").notNull().unique(),
    confirmationOn: boolean("confirmationOn").notNull(),
    // Each reminder's minutes before the appointment: 1200 is 20 hours. Empty, no reminder.
    reminderMinutesBefore: integer("reminderMinutesBefore").array().notNull(),
    replyPhone: text("replyPhone"), // a reply passed on as a text to this phone
    replyEmail: text("replyEmail"), // a reply passed on as an email to this address
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "text_settings_from_number_check",
      sql`${table.fromNumber} ~ ${sql.raw(`'${NORTH_AMERICAN_NUMBER}'`)}`
    ),
    // Its own number would pass every reply straight back to itself.
    check(
      "text_settings_reply_phone_check",
      sql`${table.replyPhone} ~ ${sql.raw(`'${NORTH_AMERICAN_NUMBER}'`)} and ${table.replyPhone} <> ${table.fromNumber}`
    ),
    // Somewhere for every reply to go, so none is ever lost.
    check(
      "text_settings_reply_destination_check",
      sql`${table.replyPhone} is not null or ${table.replyEmail} is not null`
    ),
    // Every reminder at least a minute ahead and none blank. Repeats are refused by
    // textSettingsValidationSchema: a check cannot count an array's distinct values.
    check(
      "text_settings_reminder_minutes_check",
      sql`0 < all(${table.reminderMinutesBefore}) and array_position(${table.reminderMinutesBefore}, null) is null`
    ),
  ]
);
