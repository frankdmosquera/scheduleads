// Shared: the calendar_oauth_state table. The one-time ticket for a trip to the calendar
// provider and back: made when someone presses Connect, lives ten minutes, used up once.

import { foreignKey, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "../auth-tables/organization-table.js";
import { user } from "../auth-tables/user-table.js";
import { resource } from "./resource-table.js";

export const calendarOauthState = pgTable(
  "calendar_oauth_state",
  {
    // SHA-256 (hex) of the state value. The value itself only ever exists in the consent URL.
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    resourceId: text("resourceId").notNull(),
    codeVerifier: text("codeVerifier").notNull(), // the PKCE verifier
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "calendar_oauth_state_resource_fk",
      columns: [table.organizationId, table.resourceId],
      foreignColumns: [resource.organizationId, resource.id],
    }).onDelete("cascade"),
  ]
);
