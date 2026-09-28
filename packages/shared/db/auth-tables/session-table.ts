// Shared: Better Auth's session table, one row per signed-in browser.

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./user-table.js";

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  // The business this session acts for: the source of every organizationId the API uses.
  // Filled at sign-in by the session hook in backend/lib/auth/auth-server.ts.
  activeOrganizationId: text("activeOrganizationId"),

  impersonatedBy: text("impersonatedBy"), // set while the platform admin impersonates someone
});
