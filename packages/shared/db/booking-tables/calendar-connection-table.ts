// Shared: the calendar_connection table. One person's link to their own calendar, never
// one for the business: Google's busy times come in, and later a copy of their bookings
// goes out. Disconnecting deletes the row, so no dead tokens are kept.

import { sql } from "drizzle-orm";
import { check, foreignKey, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

import { organization } from "../auth-tables/organization-table.js";
import { resource } from "./resource-table.js";

export const calendarConnection = pgTable(
  "calendar_connection",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    resourceId: text("resourceId").notNull(),
    provider: text("provider").notNull(),
    accountEmail: text("accountEmail").notNull(), // the calendar account's address, shown on the card
    // The token cipher's output (packages/shared/crypto). Never returned by a route, never logged.
    credentials: text("credentials").notNull(),
    grantedScopes: text("grantedScopes").notNull(), // space-separated, as the provider granted them
    status: text("status").notNull().default("connected"),
    lastCheckedAt: timestamp("lastCheckedAt", { withTimezone: true }), // the last successful busy read
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // A connection can only name a person of its own business.
    foreignKey({
      name: "calendar_connection_resource_fk",
      columns: [table.organizationId, table.resourceId],
      foreignColumns: [resource.organizationId, resource.id],
    }).onDelete("cascade"),
    unique("calendar_connection_resource_unique").on(table.resourceId), // one per person
    check("calendar_connection_provider_check", sql`${table.provider} in ('google')`),
    check(
      "calendar_connection_status_check",
      sql`${table.status} in ('connected', 'needs_reconnect')`
    ),
  ]
);
