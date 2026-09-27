// Shared: Better Auth's organization table, one row per business.

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  metadata: text("metadata"),

  // The subscription tier. No request can set it (input: false in auth-server.ts); only
  // Frank, by hand, until Stripe. A value subscription-limits.ts doesn't know unlocks nothing.
  plan: text("plan").notNull().default("agency"),
});
