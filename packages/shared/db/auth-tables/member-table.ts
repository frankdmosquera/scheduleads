// Shared: Better Auth's member table, who belongs to which business and with what role.

import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { organization } from "./organization-table.js";
import { user } from "./user-table.js";

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // The role IN this business (owner | admin | member). Not the platform admin role on
    // user.role: two different things, never the same check.
    role: text("role").notNull().default("member"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One membership per person per business. A duplicate would make someone with one
    // business look like they have two, and the API would refuse to pick.
    uniqueIndex("member_organization_user_unique").on(table.organizationId, table.userId),
  ]
);
