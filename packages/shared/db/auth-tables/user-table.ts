// Shared: Better Auth's user table. Matches its emailOTP, organization and admin plugins
// exactly; check its schema before changing it.

import { sql } from "drizzle-orm";
import { boolean, check, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("emailVerified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),

    // The platform admin role (Frank). Never set by a sign-in or a form of ours: only the
    // platform admin can, through Better Auth's admin plugin, or by hand in the database.
    role: text("role"),
    banned: boolean("banned").default(false),
    banReason: text("banReason"),
    banExpires: timestamp("banExpires", { withTimezone: true }),

    // The language this login reads the dashboard in (feature 12j); null until it picks one, and
    // until then it follows its browser. Only PUT /me/language writes it.
    language: text("language", { enum: ["en", "es"] }),
  },
  (table) => [check("user_language_check", sql`${table.language} in ('en', 'es')`)]
);
