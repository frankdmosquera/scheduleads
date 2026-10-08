// Shared: the text_reply table. One row per customer reply a business got, keyed by Twilio's id
// for it, recording how far its passing on got (feature 8b, decision 9). A run claims the text
// before trying it, so two runs of one reply never both send it; the email is kept to one by
// Resend's idempotency key. A reply in the same words passed on before this one was recorded is
// never taken for it. No number and no words: those stay with Twilio.

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "../auth-tables/organization-table.js";

export const textReply = pgTable("text_reply", {
  messageSid: text("messageSid").primaryKey(), // Twilio's id for the customer's text
  organizationId: text("organizationId")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  textTriedAt: timestamp("textTriedAt", { withTimezone: true }), // a run claimed the text
  textSentAt: timestamp("textSentAt", { withTimezone: true }), // Twilio took it
  emailSentAt: timestamp("emailSentAt", { withTimezone: true }), // Resend took it
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});
