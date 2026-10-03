// Shared: the email_sending_key table. One business's own Resend key, made with "Sending
// access" only, so it can send and never read (decision 6). Locked with the token cipher and
// bound to the business; read only by the code that sends. No route returns it, no screen
// shows it, no log line carries it: changing it means saving a new one.

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "./organization-table.js";

export const emailSendingKey = pgTable("email_sending_key", {
  organizationId: text("organizationId")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  credentials: text("credentials").notNull(), // the token cipher's output, bound to organizationId
  savedAt: timestamp("savedAt", { withTimezone: true }).notNull().defaultNow(),
});
