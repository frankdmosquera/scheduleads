// Shared: Better Auth's organization table, one row per business.

import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    metadata: text("metadata"),

    // The subscription tier. No request can set it (input: false in auth-server.ts); only
    // Frank, by hand, until Stripe. A value subscription-limits.ts doesn't know unlocks nothing.
    plan: text("plan").notNull().default("agency"),

    // What the business's emails need (feature 6). Set at client setup; empty means not yet, and
    // no email goes without the two addresses (decision 4). The business's own Resend key is
    // never here: Better Auth's routes return this row to members (email_sending_key, decision 6).
    senderEmail: text("senderEmail"), // the address its emails come from, at its verified domain
    notifyEmail: text("notifyEmail"), // where its booking notifications go; the owner's to start
    phone: text("phone"), // for the call button
    website: text("website"), // https://
    brandColor: text("brandColor"), // #rrggbb: email clients ignore CSS variables
  },
  (table) => [check("organization_brand_color_check", sql`${table.brandColor} ~ '^#[0-9a-f]{6}$'`)]
);
